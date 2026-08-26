import { EXPERIMENT_STORAGE_VERSION } from '../constants.js';
import { normalizeContextRule } from './contextRule.js';
import { isValidDateKey } from './date.js';
import {
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  normalizeExperiments,
  normalizePlanAdjustment,
  normalizeRetentionSnapshot,
} from './experiment.js';

const VALID_STATUSES = new Set(Object.values(EXPERIMENT_STATUS));
const VALID_DECISIONS = new Set(Object.values(EXPERIMENT_DECISION));

function optionalFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function trialMetadataPreserved(rawTrials, normalizedTrials) {
  if (!Array.isArray(rawTrials)) return rawTrials === undefined;
  if (rawTrials.length !== normalizedTrials.length) return false;
  for (let index = 0; index < rawTrials.length; index += 1) {
    const raw = rawTrials[index];
    const normalized = normalizedTrials[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;
    if (raw.observedValue !== undefined && raw.observedValue !== null && raw.observedValue !== '') {
      const numeric = optionalFiniteNumber(raw.observedValue);
      if (numeric === null || normalized.observedValue !== numeric) return false;
    }
  }
  return true;
}

function explicitMetadataPreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;

  if (!trialMetadataPreserved(raw.trials, normalized.trials)) return false;

  if (raw.planAdjustment !== undefined) {
    if (raw.planAdjustment === null) {
      if (normalized.planAdjustment !== null) return false;
    } else {
      const adjustment = normalizePlanAdjustment(raw.planAdjustment);
      if (!adjustment || !sameJson(adjustment, normalized.planAdjustment)) return false;
    }
  }

  if (raw.contextRule !== undefined) {
    if (raw.contextRule === null) {
      if (normalized.contextRule !== null) return false;
    } else {
      const rule = normalizeContextRule(raw.contextRule);
      if (!rule || !sameJson(rule, normalized.contextRule)) return false;
    }
  }

  if (raw.sourceRetention !== undefined) {
    if (raw.sourceRetention === null) {
      if (normalized.sourceRetention !== null) return false;
    } else {
      const snapshot = normalizeRetentionSnapshot(raw.sourceRetention);
      if (!snapshot || !sameJson(snapshot, normalized.sourceRetention)) return false;
    }
  }

  if (raw.decisionDateKey !== undefined && raw.decisionDateKey !== null) {
    if (!isValidDateKey(raw.decisionDateKey) || normalized.decisionDateKey !== raw.decisionDateKey) return false;
  }

  if (raw.status !== undefined && !VALID_STATUSES.has(raw.status)) return false;
  if (raw.decision !== undefined && raw.decision !== null && !VALID_DECISIONS.has(raw.decision)) return false;

  if (raw.learningRootId !== undefined) {
    if (typeof raw.learningRootId !== 'string' || !raw.learningRootId.trim() || normalized.learningRootId !== raw.learningRootId.trim()) return false;
  }
  if (raw.parentExperimentId !== undefined) {
    const parent = raw.parentExperimentId === null
      ? null
      : (typeof raw.parentExperimentId === 'string' && raw.parentExperimentId.trim() ? raw.parentExperimentId.trim() : undefined);
    if (parent === undefined || normalized.parentExperimentId !== parent) return false;
  }
  if (raw.learningVersion !== undefined) {
    const version = optionalFiniteNumber(raw.learningVersion);
    if (!Number.isInteger(version) || version < 1 || version > 999 || normalized.learningVersion !== version) return false;
  }
  if (raw.revalidationReason !== undefined) {
    if (typeof raw.revalidationReason !== 'string' || normalized.revalidationReason !== raw.revalidationReason.trim()) return false;
  }

  if (raw.baselineFailureRate !== undefined && raw.baselineFailureRate !== null && raw.baselineFailureRate !== '') {
    const rate = optionalFiniteNumber(raw.baselineFailureRate);
    if (rate === null || rate < 0 || rate > 1 || normalized.baselineFailureRate !== rate) return false;
  }
  if (raw.baselineSampleCount !== undefined && raw.baselineSampleCount !== null && raw.baselineSampleCount !== '') {
    const count = optionalFiniteNumber(raw.baselineSampleCount);
    if (!Number.isInteger(count) || count < 0 || normalized.baselineSampleCount !== count) return false;
  }

  return true;
}

function parsePayload(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, rawExperiments: [], unsupportedVersion: null }; }
  if (Array.isArray(parsed)) return { ok: true, rawExperiments: parsed, unsupportedVersion: null };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, rawExperiments: [], unsupportedVersion: null };
  if (parsed.version !== EXPERIMENT_STORAGE_VERSION) {
    return { ok: false, rawExperiments: [], unsupportedVersion: parsed.version ?? 'unknown' };
  }
  if (!Array.isArray(parsed.experiments)) return { ok: false, rawExperiments: [], unsupportedVersion: null };
  return { ok: true, rawExperiments: parsed.experiments, unsupportedVersion: null };
}

export function parseStoredExperimentsForPersistence(raw) {
  if (!raw) return { ok: true, experiments: [], unsupportedVersion: null };
  const payload = parsePayload(raw);
  if (!payload.ok) return { ok: false, experiments: [], unsupportedVersion: payload.unsupportedVersion };

  const experiments = normalizeExperiments(payload.rawExperiments);
  if (experiments.length !== payload.rawExperiments.length) {
    return { ok: false, experiments: [], unsupportedVersion: null };
  }
  for (let index = 0; index < payload.rawExperiments.length; index += 1) {
    if (!explicitMetadataPreserved(payload.rawExperiments[index], experiments[index])) {
      return { ok: false, experiments: [], unsupportedVersion: null };
    }
  }
  return { ok: true, experiments, unsupportedVersion: null };
}
