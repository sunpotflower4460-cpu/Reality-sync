import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPERIMENT_STORAGE_KEY, EXPERIMENT_STORAGE_VERSION } from '../constants.js';
import { buildContextualRetentionBaseline, normalizeContextRule } from '../utils/contextRule.js';
import { dateKeyFromDate, shiftDateKey } from '../utils/date.js';
import {
  abandonExperiment,
  addExperimentTrial,
  createExperimentFromCandidate,
  createRevalidationExperiment,
  finishExperiment,
  nextLearningVersion,
  removeExperimentTrial,
  serializeExperiments,
} from '../utils/experiment.js';
import { parseStoredExperimentsForPersistence } from '../utils/experimentStorage.js';
import { createUniqueId, hasDuplicateIds } from '../utils/id.js';

function validatedExperiments(next) {
  if (!Array.isArray(next) || hasDuplicateIds(next)) return null;
  const result = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: next,
  }));
  return result.ok ? result.experiments : null;
}

function canonicalExperiments(experiments) {
  return serializeExperiments(experiments);
}

function loadExperimentState() {
  if (typeof window === 'undefined') {
    return {
      experiments: [],
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: canonicalExperiments([]),
      writeConflict: false,
    };
  }
  try {
    const raw = window.localStorage.getItem(EXPERIMENT_STORAGE_KEY);
    const result = parseStoredExperimentsForPersistence(raw);
    return {
      experiments: result.experiments,
      persistenceBlocked: !result.ok,
      unsupportedVersion: result.unsupportedVersion,
      writeFailed: false,
      // Older releases stored the experiment list as a bare array. It is safe
      // to migrate only that known legacy shape to the versioned wrapper.
      needsWrite: Boolean(raw) && result.ok && raw.trimStart().startsWith('['),
      baseSerialized: canonicalExperiments(result.experiments),
      writeConflict: false,
    };
  } catch {
    return {
      experiments: [],
      persistenceBlocked: true,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: canonicalExperiments([]),
      writeConflict: false,
    };
  }
}

export function useExperiments() {
  const [state, setState] = useState(loadExperimentState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const {
    experiments,
    persistenceBlocked,
    unsupportedVersion,
    writeFailed,
    needsWrite,
    baseSerialized,
    writeConflict,
  } = state;

  useEffect(() => {
    if (persistenceBlocked || writeConflict || !needsWrite) return;
    try {
      const latest = parseStoredExperimentsForPersistence(
        window.localStorage.getItem(EXPERIMENT_STORAGE_KEY),
      );
      if (!latest.ok) {
        setState((current) => ({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: latest.unsupportedVersion,
          needsWrite: false,
        }));
        return;
      }
      const latestSerialized = canonicalExperiments(latest.experiments);
      if (latestSerialized !== baseSerialized) {
        setState((current) => ({
          ...current,
          writeConflict: true,
          writeFailed: false,
          needsWrite: false,
        }));
        return;
      }

      const writtenSerialized = canonicalExperiments(experiments);
      window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, writtenSerialized);
      setState((current) => {
        const currentSerialized = canonicalExperiments(current.experiments);
        const changedAgain = currentSerialized !== writtenSerialized;
        return {
          ...current,
          writeFailed: false,
          needsWrite: changedAgain,
          baseSerialized: writtenSerialized,
        };
      });
    } catch {
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [baseSerialized, experiments, needsWrite, persistenceBlocked, writeConflict]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== EXPERIMENT_STORAGE_KEY) return;
      const result = parseStoredExperimentsForPersistence(event.newValue);
      setState((current) => {
        if (!result.ok) {
          return {
            ...current,
            persistenceBlocked: true,
            unsupportedVersion: result.unsupportedVersion,
            writeFailed: false,
            needsWrite: false,
          };
        }
        const externalSerialized = canonicalExperiments(result.experiments);
        if (current.needsWrite) {
          if (externalSerialized !== current.baseSerialized) {
            return {
              ...current,
              writeConflict: true,
              writeFailed: false,
              needsWrite: false,
            };
          }
          return current;
        }
        if (current.writeConflict) return current;
        return {
          experiments: result.experiments,
          persistenceBlocked: false,
          unsupportedVersion: null,
          writeFailed: false,
          needsWrite: false,
          baseSerialized: externalSerialized,
          writeConflict: false,
        };
      });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // User actions can fire more than once before React renders the first update.
  // Keep a synchronous snapshot so a second click evaluates against the first
  // accepted mutation rather than the stale render-time experiments array.
  const updateExperiments = useCallback((updater) => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return false;
    const next = typeof updater === 'function' ? updater(current.experiments) : updater;
    const validated = validatedExperiments(next);
    if (!validated) return false;
    const nextState = { ...current, experiments: validated, needsWrite: true };
    stateRef.current = nextState;
    setState(nextState);
    return true;
  }, []);

  const startExperiment = useCallback((candidate, options) => (
    updateExperiments((current) => {
      if (!candidate?.id) return null;
      if (current.some((experiment) => (
        experiment.status === 'active' && experiment.candidateId === candidate.id
      ))) return null;
      const id = createUniqueId('experiment', current.map((experiment) => experiment.id));
      const experiment = createExperimentFromCandidate(candidate, { ...options, id });
      return experiment ? [experiment, ...current] : null;
    })
  ), [updateExperiments]);

  const startRevalidation = useCallback((sourceExperimentId, retentionSummary, options = {}) => {
    const today = dateKeyFromDate();
    if (!retentionSummary?.reviewCandidate || retentionSummary.throughDateKey !== today) return false;

    const contextRule = options.contextRule === undefined || options.contextRule === null
      ? null
      : normalizeContextRule(options.contextRule);
    if (options.contextRule !== undefined && options.contextRule !== null && !contextRule) return false;
    const contextBaseline = contextRule
      ? buildContextualRetentionBaseline(contextRule, retentionSummary, options.days)
      : null;
    if (contextRule && !contextBaseline?.ok) return false;

    return updateExperiments((current) => {
      const source = current.find((experiment) => experiment.id === sourceExperimentId);
      if (!source) return null;
      const rootId = source.learningRootId || source.id;
      if (current.some((experiment) => (
        experiment.status === 'active' && (experiment.learningRootId || experiment.id) === rootId
      ))) return null;

      const experiment = createRevalidationExperiment(source, retentionSummary, {
        ...options,
        contextRule,
        contextBaseline,
        id: createUniqueId('experiment', current.map((item) => item.id)),
        startDateKey: shiftDateKey(today, 1),
        learningVersion: nextLearningVersion(current, source),
        createdAt: new Date().toISOString(),
      });
      return experiment ? [experiment, ...current] : null;
    });
  }, [updateExperiments]);

  const captureTrial = useCallback((experimentId, eligibleRecord) => {
    return updateExperiments((current) => current.map((experiment) => (
      experiment.id === experimentId ? addExperimentTrial(experiment, eligibleRecord) : experiment
    )));
  }, [updateExperiments]);

  const removeTrial = useCallback((experimentId, recordKey) => {
    return updateExperiments((current) => current.map((experiment) => (
      experiment.id === experimentId ? removeExperimentTrial(experiment, recordKey) : experiment
    )));
  }, [updateExperiments]);

  const finish = useCallback((experimentId, decision) => {
    const completedAt = new Date().toISOString();
    const decisionDateKey = dateKeyFromDate();
    return updateExperiments((current) => current.map((experiment) => (
      experiment.id === experimentId
        ? finishExperiment(experiment, decision, completedAt, decisionDateKey)
        : experiment
    )));
  }, [updateExperiments]);

  const abandon = useCallback((experimentId) => {
    return updateExperiments((current) => current.map((experiment) => (
      experiment.id === experimentId ? abandonExperiment(experiment) : experiment
    )));
  }, [updateExperiments]);

  const deleteExperiment = useCallback((experimentId) => (
    updateExperiments((current) => {
      if (!current.some((experiment) => experiment.id === experimentId)) return null;
      if (current.some((experiment) => experiment.parentExperimentId === experimentId)) return null;
      return current.filter((experiment) => experiment.id !== experimentId);
    })
  ), [updateExperiments]);

  const replaceExperiments = useCallback((next) => {
    const validated = validatedExperiments(Array.isArray(next) ? next : []);
    if (!validated) return false;
    const nextState = {
      experiments: validated,
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: canonicalExperiments(validated),
      writeConflict: false,
    };
    stateRef.current = nextState;
    setState(nextState);
    return true;
  }, []);

  return {
    experiments,
    startExperiment,
    startRevalidation,
    captureTrial,
    removeTrial,
    finish,
    abandon,
    deleteExperiment,
    replaceExperiments,
    storageProtection: {
      persistenceBlocked,
      unsupportedVersion,
      writeFailed,
      writeConflict,
    },
  };
}
