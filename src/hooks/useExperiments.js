import { useCallback, useEffect, useState } from 'react';
import { EXPERIMENT_STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import {
  abandonExperiment,
  addExperimentTrial,
  createExperimentFromCandidate,
  finishExperiment,
  normalizeExperiments,
  parseStoredExperiments,
  removeExperimentTrial,
  serializeExperiments,
} from '../utils/experiment.js';

function createExperimentId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `experiment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadExperiments() {
  if (typeof window === 'undefined') return [];
  try { return parseStoredExperiments(window.localStorage.getItem(EXPERIMENT_STORAGE_KEY)); } catch { return []; }
}

export function useExperiments() {
  const [experiments, setExperiments] = useState(loadExperiments);

  useEffect(() => {
    try { window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, serializeExperiments(experiments)); } catch { /* in-memory mode */ }
  }, [experiments]);

  useEffect(() => {
    const sync = (event) => { if (event.key === EXPERIMENT_STORAGE_KEY) setExperiments(parseStoredExperiments(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const startExperiment = useCallback((candidate, options) => {
    const experiment = createExperimentFromCandidate(candidate, { ...options, id: createExperimentId() });
    if (!experiment) return false;
    setExperiments((current) => [experiment, ...current]);
    return true;
  }, []);

  const captureTrial = useCallback((experimentId, eligibleRecord) => {
    setExperiments((current) => current.map((experiment) => experiment.id === experimentId ? addExperimentTrial(experiment, eligibleRecord) : experiment));
  }, []);

  const removeTrial = useCallback((experimentId, recordKey) => {
    setExperiments((current) => current.map((experiment) => experiment.id === experimentId ? removeExperimentTrial(experiment, recordKey) : experiment));
  }, []);

  const finish = useCallback((experimentId, decision) => {
    const completedAt = new Date().toISOString();
    const decisionDateKey = dateKeyFromDate();
    setExperiments((current) => current.map((experiment) => experiment.id === experimentId ? finishExperiment(experiment, decision, completedAt, decisionDateKey) : experiment));
  }, []);

  const abandon = useCallback((experimentId) => {
    setExperiments((current) => current.map((experiment) => experiment.id === experimentId ? abandonExperiment(experiment) : experiment));
  }, []);

  const deleteExperiment = useCallback((experimentId) => {
    setExperiments((current) => current.filter((experiment) => experiment.id !== experimentId));
  }, []);

  const replaceExperiments = useCallback((next) => setExperiments(normalizeExperiments(next)), []);

  return { experiments, startExperiment, captureTrial, removeTrial, finish, abandon, deleteExperiment, replaceExperiments };
}
