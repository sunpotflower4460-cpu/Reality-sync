import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPERIMENT_STORAGE_KEY, EXPERIMENT_STORAGE_VERSION } from '../constants.js';
import { buildContextualRetentionBaseline, normalizeContextRule } from '../utils/contextRule.js';
import { dateKeyFromDate, isValidDateKey, shiftDateKey } from '../utils/date.js';
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

function canonicalRecordKey(record) {
  if (!record || !isValidDateKey(record.dateKey)) return null;
  const scheduleId = typeof record.scheduleId === 'number' && Number.isFinite(record.scheduleId)
    ? String(record.scheduleId)
    : typeof record.scheduleId === 'string' && record.scheduleId.trim()
      ? record.scheduleId.trim()
      : null;
  return scheduleId ? `${record.dateKey}::${scheduleId}` : null;
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
  const applyState = useCallback((updater) => {
    const current = stateRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    stateRef.current = next;
    setState(next);
    return next;
  }, []);
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
        applyState((current) => ({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: latest.unsupportedVersion,
          needsWrite: false,
        }));
        return;
      }
      const latestSerialized = canonicalExperiments(latest.experiments);
      if (latestSerialized !== baseSerialized) {
        applyState((current) => ({
          ...current,
          writeConflict: true,
          writeFailed: false,
          needsWrite: false,
        }));
        return;
      }

      const writtenSerialized = canonicalExperiments(experiments);
      const preWrite = parseStoredExperimentsForPersistence(
        window.localStorage.getItem(EXPERIMENT_STORAGE_KEY),
      );
      if (!preWrite.ok) {
        applyState((current) => ({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: preWrite.unsupportedVersion,
          needsWrite: false,
        }));
        return;
      }
      const preWriteSerialized = canonicalExperiments(preWrite.experiments);
      if (preWriteSerialized !== latestSerialized) {
        applyState((current) => ({
          ...current,
          writeConflict: true,
          writeFailed: false,
          needsWrite: false,
        }));
        return;
      }

      window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, writtenSerialized);
      const readBack = parseStoredExperimentsForPersistence(
        window.localStorage.getItem(EXPERIMENT_STORAGE_KEY),
      );
      if (!readBack.ok) {
        applyState((current) => ({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: readBack.unsupportedVersion,
          needsWrite: false,
        }));
        return;
      }
      const readBackSerialized = canonicalExperiments(readBack.experiments);
      if (readBackSerialized !== writtenSerialized) {
        if (readBackSerialized === preWriteSerialized) {
          applyState((current) => ({ ...current, writeFailed: true }));
        } else {
          applyState((current) => ({
            ...current,
            writeConflict: true,
            writeFailed: false,
            needsWrite: false,
          }));
        }
        return;
      }

      applyState((current) => {
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
      applyState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [applyState, baseSerialized, experiments, needsWrite, persistenceBlocked, writeConflict]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== EXPERIMENT_STORAGE_KEY) return;
      const result = parseStoredExperimentsForPersistence(event.newValue);
      applyState((current) => {
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
  }, [applyState]);

  const latestStateBeforeMutation = useCallback(() => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return null;
    try {
      const latest = parseStoredExperimentsForPersistence(
        window.localStorage.getItem(EXPERIMENT_STORAGE_KEY),
      );
      if (!latest.ok) {
        applyState({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: latest.unsupportedVersion,
          needsWrite: false,
        });
        return null;
      }
      const latestSerialized = canonicalExperiments(latest.experiments);
      if (latestSerialized === current.baseSerialized) return current;
      if (current.needsWrite) {
        applyState({ ...current, writeConflict: true, writeFailed: false, needsWrite: false });
        return null;
      }
      return {
        experiments: latest.experiments,
        persistenceBlocked: false,
        unsupportedVersion: null,
        writeFailed: false,
        needsWrite: false,
        baseSerialized: latestSerialized,
        writeConflict: false,
      };
    } catch {
      applyState({ ...current, persistenceBlocked: true, needsWrite: false });
      return null;
    }
  }, [applyState]);

  // User actions can fire before React renders a storage event or before a
  // previous accepted click renders. Preflight both the synchronous hook state
  // and device storage before accepting the mutation.
  const updateExperiments = useCallback((updater) => {
    const current = latestStateBeforeMutation();
    if (!current) return false;
    const next = typeof updater === 'function' ? updater(current.experiments) : updater;
    const validated = validatedExperiments(next);
    if (!validated) {
      if (current !== stateRef.current) applyState(current);
      return false;
    }
    if (canonicalExperiments(validated) === canonicalExperiments(current.experiments)) {
      if (current !== stateRef.current) applyState(current);
      return false;
    }
    applyState({ ...current, experiments: validated, needsWrite: true });
    return true;
  }, [applyState, latestStateBeforeMutation]);

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
    return updateExperiments((current) => {
      const target = current.find((experiment) => experiment.id === experimentId);
      if (!target || target.status !== 'active' || target.trials.length >= target.targetRuns) return null;
      const expectedRecordKey = canonicalRecordKey(eligibleRecord);
      if (
        !expectedRecordKey
        || eligibleRecord.recordKey !== expectedRecordKey
        || eligibleRecord.dateKey < target.startDateKey
      ) return null;
      const updated = addExperimentTrial(target, eligibleRecord);
      if (!updated || updated.trials.length !== target.trials.length + 1) return null;
      return current.map((experiment) => experiment.id === experimentId ? updated : experiment);
    });
  }, [updateExperiments]);

  const removeTrial = useCallback((experimentId, recordKey) => {
    return updateExperiments((current) => current.map((experiment) => (
      experiment.id === experimentId ? removeExperimentTrial(experiment, recordKey) : experiment
    )));
  }, [updateExperiments]);

  const finish = useCallback((experimentId, decision) => {
    const completedAt = new Date().toISOString();
    const decisionDateKey = dateKeyFromDate();
    return updateExperiments((current) => {
      const target = current.find((experiment) => experiment.id === experimentId);
      if (!target || target.status !== 'active') return null;
      const updated = finishExperiment(target, decision, completedAt, decisionDateKey);
      if (!updated || updated.status !== 'completed') return null;
      return current.map((experiment) => experiment.id === experimentId ? updated : experiment);
    });
  }, [updateExperiments]);

  const abandon = useCallback((experimentId) => {
    return updateExperiments((current) => {
      const target = current.find((experiment) => experiment.id === experimentId);
      if (!target || target.status !== 'active') return null;
      const updated = abandonExperiment(target);
      if (!updated || updated.status !== 'abandoned') return null;
      return current.map((experiment) => experiment.id === experimentId ? updated : experiment);
    });
  }, [updateExperiments]);

  const deleteExperiment = useCallback((experimentId) => (
    updateExperiments((current) => {
      const target = current.find((experiment) => experiment.id === experimentId);
      if (!target) return null;
      // An adopted experiment can already be referenced by schedules/templates
      // through appliedExperimentIds. Deleting a leaf would also make an older
      // adopted lineage version appear current again, resurrecting stale advice.
      // Keep adopted learning as provenance; full app-data erase remains the
      // explicit destructive path when the user wants all history removed.
      if (target.status === 'completed' && target.decision === 'adopt') return null;
      if (current.some((experiment) => experiment.parentExperimentId === experimentId)) return null;
      return current.filter((experiment) => experiment.id !== experimentId);
    })
  ), [updateExperiments]);

  // Planning feedback mutates the schedule domain using experiment data. Resolve
  // that source synchronously from the latest readable experiment storage and
  // require the exact revision the user reviewed before allowing the mutation.
  const resolveExperimentForMutation = useCallback((experimentId, expectedRevision) => {
    const current = latestStateBeforeMutation();
    if (!current) return null;
    const experiment = current.experiments.find((item) => item.id === experimentId) ?? null;
    const revisionMatches = experiment && JSON.stringify(experiment) === expectedRevision;
    if (current !== stateRef.current) applyState(current);
    return revisionMatches ? experiment : null;
  }, [applyState, latestStateBeforeMutation]);

  const replaceExperiments = useCallback((next) => {
    const validated = validatedExperiments(Array.isArray(next) ? next : []);
    if (!validated) return false;
    applyState({
      experiments: validated,
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: canonicalExperiments(validated),
      writeConflict: false,
    });
    return true;
  }, [applyState]);

  return {
    experiments,
    startExperiment,
    startRevalidation,
    captureTrial,
    removeTrial,
    finish,
    abandon,
    deleteExperiment,
    resolveExperimentForMutation,
    replaceExperiments,
    storageProtection: {
      persistenceBlocked,
      unsupportedVersion,
      writeFailed,
      writeConflict,
    },
  };
}
