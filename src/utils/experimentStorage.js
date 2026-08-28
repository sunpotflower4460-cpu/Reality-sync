import { CATEGORIES, EXPERIMENT_STORAGE_VERSION } from '../constants.js';
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
const PAYLOAD_FIELDS = new Set(['version', 'experiments']);
const EXPERIMENT_FIELDS = new Set([
  'id',
  'candidateId',
  'candidateType',
  'title',
  'hypothesis',
  'action',
  'metricKind',
  'metricLabel',
  'condition',
  'contextRule',
  'startDateKey',
  'targetRuns',
  'baselineFailureRate',
  'baselineSampleCount',
  'planAdjustment',
  'learningRootId',
  'parentExperimentId',
  'learningVersion',
  'revalidationReason',
  'sourceRetention',
  'status',
  'decision',
  'decisionDateKey',
  'trials',
  'createdAt',
  'completedAt',
]);
const TRIAL_FIELDS = new Set([
  'id',
  'recordKey',
  'dateKey',
  'scheduleId',
  'planTitle',
  'outcome',
  'observedValue',
  'observedLabel',
  'capturedAt',
]);
const CONDITION_FIELDS = new Set(['kind', 'value']);
const PLAN_ADJUSTMENT_FIELDS = new Set(['kind', 'minutes']);
const CONTEXT_RULE_FIELDS = new Set([
  'metric',
  'operator',
  'threshold',
  'category',
  'sourceCandidateId',
  'sourcePreviousValue',
  'sourceRecentValue',
  'sourceThroughDateKey',
]);
const RETENTION_FIELDS = new Set([
  'experimentId',
  'throughDateKey',
  'assessmentCount',
  'weekCount',
  'failureRate',
  'experimentFailureRate',
  'differenceFromExperimentPoints',
  'capturedAt',
]);

function objectHasOnlyKeys(value, allowed) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function optionalFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function explicitTextPreserved(rawValue, normalizedValue) {
  return typeof rawValue === 'string' && normalizedValue === rawValue.trim();
}

function trialMetadataPreserved(rawTrials, normalizedTrials) {
  if (!Array.isArray(rawTrials)) return rawTrials === undefined;
  if (rawTrials.length !== normalizedTrials.length) return false;
  for (let index = 0; index < rawTrials.length; index += 1) {
    const raw = rawTrials[index];
    const normalized = normalizedTrials[index];
    if (!objectHasOnlyKeys(raw, TRIAL_FIELDS) || !normalized) return false;
    if (raw.observedValue !== undefined && raw.observedValue !== null && raw.observedValue !== '') {
      const numeric = optionalFiniteNumber(raw.observedValue);
      if (numeric === null || normalized.observedValue !== numeric) return false;
    }
    if (raw.capturedAt !== undefined && !explicitTextPreserved(raw.capturedAt, normalized.capturedAt)) return false;
    if (raw.planTitle !== undefined && !explicitTextPreserved(raw.planTitle, normalized.planTitle)) return false;
    if (raw.scheduleId !== undefined) {
      if ((typeof raw.scheduleId !== 'string' && typeof raw.scheduleId !== 'number') || normalized.scheduleId !== String(raw.scheduleId).trim()) return false;
    }
  }
  return true;
}

function explicitMetadataPreserved(raw, normalized) {
  if (!objectHasOnlyKeys(raw, EXPERIMENT_FIELDS) || !normalized) return false;

  if (typeof raw.id !== 'string' || !raw.id.trim() || normalized.id !== raw.id.trim()) return false;
  if (!objectHasOnlyKeys(raw.condition, CONDITION_FIELDS) || !sameJson(raw.condition, normalized.condition)) return false;
  if (raw.condition.kind === 'planned-category' && !CATEGORIES.includes(raw.condition.value)) return false;
  if (!trialMetadataPreserved(raw.trials, normalized.trials)) return false;

  if (raw.targetRuns !== undefined) {
    const targetRuns = optionalFiniteNumber(raw.targetRuns);
    if (!Number.isInteger(targetRuns) || targetRuns < 3 || targetRuns > 10 || normalized.targetRuns !== targetRuns) return false;
  }

  if (raw.planAdjustment !== undefined) {
    if (raw.planAdjustment === null) {
      if (normalized.planAdjustment !== null) return false;
    } else {
      if (!objectHasOnlyKeys(raw.planAdjustment, PLAN_ADJUSTMENT_FIELDS)) return false;
      const adjustment = normalizePlanAdjustment(raw.planAdjustment);
      if (!adjustment || !sameJson(adjustment, normalized.planAdjustment)) return false;
    }
  }

  if (raw.contextRule !== undefined) {
    if (raw.contextRule === null) {
      if (normalized.contextRule !== null) return false;
    } else {
      if (!objectHasOnlyKeys(raw.contextRule, CONTEXT_RULE_FIELDS)) return false;
      const rule = normalizeContextRule(raw.contextRule);
      if (!rule || !sameJson(rule, normalized.contextRule)) return false;
    }
  }

  if (raw.sourceRetention !== undefined) {
    if (raw.sourceRetention === null) {
      if (normalized.sourceRetention !== null) return false;
    } else {
      if (!objectHasOnlyKeys(raw.sourceRetention, RETENTION_FIELDS)) return false;
      const snapshot = normalizeRetentionSnapshot(raw.sourceRetention);
      if (!snapshot || !sameJson(snapshot, normalized.sourceRetention)) return false;
    }
  }

  if (raw.decisionDateKey !== undefined) {
    if (raw.decisionDateKey === null) {
      if (normalized.decisionDateKey !== null) return false;
    } else if (!isValidDateKey(raw.decisionDateKey) || normalized.decisionDateKey !== raw.decisionDateKey) return false;
  }

  if (raw.status !== undefined && (!VALID_STATUSES.has(raw.status) || normalized.status !== raw.status)) return false;
  if (raw.decision !== undefined) {
    if (raw.decision === null) {
      if (normalized.decision !== null) return false;
    } else if (!VALID_DECISIONS.has(raw.decision) || normalized.decision !== raw.decision) return false;
  }

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
    if (!explicitTextPreserved(raw.revalidationReason, normalized.revalidationReason)) return false;
  }

  if (raw.baselineFailureRate !== undefined) {
    if (raw.baselineFailureRate === null) {
      if (normalized.baselineFailureRate !== null) return false;
    } else {
      const rate = optionalFiniteNumber(raw.baselineFailureRate);
      if (rate === null || rate < 0 || rate > 1 || normalized.baselineFailureRate !== rate) return false;
    }
  }
  if (raw.baselineSampleCount !== undefined) {
    const count = optionalFiniteNumber(raw.baselineSampleCount);
    if (!Number.isInteger(count) || count < 0 || count > 100000 || normalized.baselineSampleCount !== count) return false;
  }

  if (raw.createdAt !== undefined && !explicitTextPreserved(raw.createdAt, normalized.createdAt)) return false;
  if (raw.completedAt !== undefined && !explicitTextPreserved(raw.completedAt, normalized.completedAt)) return false;

  return true;
}

function parsePayload(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, rawExperiments: [], unsupportedVersion: null }; }
  if (Array.isArray(parsed)) return { ok: true, rawExperiments: parsed, unsupportedVersion: null };
  if (!objectHasOnlyKeys(parsed, PAYLOAD_FIELDS)) return { ok: false, rawExperiments: [], unsupportedVersion: null };
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
