import { useCallback, useEffect, useState } from 'react';
import { EXPERIMENT_STORAGE_KEY } from '../constants.js';
import { buildContextualRetentionBaseline, normalizeContextRule } from '../utils/contextRule.js';
import { dateKeyFromDate, shiftDateKey } from '../utils/date.js';
import {
  abandonExperiment,
  addExperimentTrial,
  createExperimentFromCandidate,
  createRevalidationExperiment,
  finishExperiment,
  nextLearningVersion,
  normalizeExperiments,
  removeExperimentTrial,
  serializeExperiments,
} from '../utils/experiment.js';
import { parseStoredExperimentsForPersistence } from '../utils/experimentStorage.js';
import { createUniqueId, hasDuplicateIds } from '../utils/id.js';

function validatedExperiments(next) {
  if (!Array.isArray(next) || hasDuplicateIds(next)) return null;
  const normalized = normalizeExperiments(next);
  if (normalized.length !== next.length) return null;
  const result = parseStoredExperimentsForPersistence(serializeExperiments(normalized));
  return result.ok ? result.experiments : null;
}

function loadExperimentState() {
  if (typeof window === 'undefined') return { experiments: [], persistenceBlocked: false, unsupportedVersion: null };
  try {
    const result = parseStoredExperimentsForPersistence(window.localStorage.getItem(EXPERIMENT_STORAGE_KEY));
    return {
      experiments: result.experiments,
      persistenceBlocked: !result.ok,
      unsupportedVersion: result.unsupportedVersion,
    };
  } catch {
    return { experiments: [], persistenceBlocked: false, unsupportedVersion: null };
  }
}

export function useExperiments() {
  const [state, setState] = useState(loadExperimentState);
  const { experiments, persistenceBlocked, unsupportedVersion } = state;

  useEffect(() => {
    if (persistenceBlocked) return;
    try { window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, serializeExperiments(experiments)); } catch { /* in-memory mode */ }
  }, [experiments, persistenceBlocked]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== EXPERIMENT_STORAGE_KEY) return;
      const result = parseStoredExperimentsForPersistence(event.newValue);
      setState({
        experiments: result.experiments,
        persistenceBlocked: !result.ok,
        unsupportedVersion: result.unsupportedVersion,
      });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const updateExperiments = useCallback((updater) => {
    setState((current) => {
      if (current.persistenceBlocked) return current;
      const next = typeof updater === 'function' ? updater(current.experiments) : updater;
      const validated = validatedExperiments(next);
      if (!validated) return current;
      return { ...current, experiments: validated };
    });
  }, []);

  const startExperiment = useCallback((candidate, options) => {
    if (persistenceBlocked) return false;
    const id = createUniqueId('experiment', experiments.map((experiment) => experiment.id));
    const experiment = createExperimentFromCandidate(candidate, { ...options, id });
    if (!experiment) return false;
    updateExperiments((current) => [experiment, ...current]);
    return true;
  }, [experiments, persistenceBlocked, updateExperiments]);

  const startRevalidation = useCallback((sourceExperimentId, retentionSummary, options = {}) => {
    if (persistenceBlocked) return false;
    const today = dateKeyFromDate();
    if (!retentionSummary?.reviewCandidate || retentionSummary.throughDateKey !== today) return false;
    const source = experiments.find((experiment) => experiment.id === sourceExperimentId);
    if (!source) return false;
    const rootId = source.learningRootId || source.id;
    if (experiments.some((experiment) => experiment.status === 'active' && (experiment.learningRootId || experiment.id) === rootId)) return false;

    const contextRule = options.contextRule === undefined || options.contextRule === null
      ? null
      : normalizeContextRule(options.contextRule);
    if (options.contextRule !== undefined && options.contextRule !== null && !contextRule) return false;
    const contextBaseline = contextRule
      ? buildContextualRetentionBaseline(contextRule, retentionSummary, options.days)
      : null;
    if (contextRule && !contextBaseline?.ok) return false;

    const experiment = createRevalidationExperiment(source, retentionSummary, {
      ...options,
      contextRule,
      contextBaseline,
      id: createUniqueId('experiment', experiments.map((item) => item.id)),
      startDateKey: shiftDateKey(today, 1),
      learningVersion: nextLearningVersion(experiments, source),
      createdAt: new Date().toISOString(),
    });
    if (!experiment) return false;
    updateExperiments((current) => [experiment, ...current]);
    return true;
  }, [experiments, persistenceBlocked, updateExperiments]);

  const captureTrial = useCallback((experimentId, eligibleRecord) => {
    updateExperiments((current) => current.map((experiment) => experiment.id === experimentId ? addExperimentTrial(experiment, eligibleRecord) : experiment));
  }, [updateExperiments]);

  const removeTrial = useCallback((experimentId, recordKey) => {
    updateExperiments((current) => current.map((experiment) => experiment.id === experimentId ? removeExperimentTrial(experiment, recordKey) : experiment));
  }, [updateExperiments]);

  const finish = useCallback((experimentId, decision) => {
    const completedAt = new Date().toISOString();
    const decisionDateKey = dateKeyFromDate();
    updateExperiments((current) => current.map((experiment) => experiment.id === experimentId ? finishExperiment(experiment, decision, completedAt, decisionDateKey) : experiment));
  }, [updateExperiments]);

  const abandon = useCallback((experimentId) => {
    updateExperiments((current) => current.map((experiment) => experiment.id === experimentId ? abandonExperiment(experiment) : experiment));
  }, [updateExperiments]);

  const deleteExperiment = useCallback((experimentId) => {
    updateExperiments((current) => current.filter((experiment) => experiment.id !== experimentId));
  }, [updateExperiments]);

  const replaceExperiments = useCallback((next) => {
    const validated = validatedExperiments(Array.isArray(next) ? next : []);
    if (!validated) return;
    setState({ experiments: validated, persistenceBlocked: false, unsupportedVersion: null });
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
    storageProtection: { persistenceBlocked, unsupportedVersion },
  };
}
