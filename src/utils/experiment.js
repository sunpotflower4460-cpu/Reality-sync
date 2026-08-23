import { EXPERIMENT_STORAGE_VERSION, STATUS } from '../constants.js';
import { differenceInCalendarDays, isValidDateKey, weekdayIndexMondayFirst } from './date.js';
import { exactStartDeltaMinutes } from './analytics.js';
import { normalizeSchedules, recordedPlanForSchedule } from './schedule.js';

export const EXPERIMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
});

export const EXPERIMENT_DECISION = Object.freeze({
  ADOPT: 'adopt',
  HOLD: 'hold',
  REJECT: 'reject',
});

export const EXPERIMENT_METRIC = Object.freeze({
  DEVIATION: 'deviation',
  LATE_START: 'late-start',
});

const VALID_STATUSES = new Set(Object.values(EXPERIMENT_STATUS));
const VALID_DECISIONS = new Set(Object.values(EXPERIMENT_DECISION));
const VALID_METRICS = new Set(Object.values(EXPERIMENT_METRIC));
const VALID_CONDITIONS = new Set(['weekday', 'planned-stress-min', 'planned-category']);

function text(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeRate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeCondition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !VALID_CONDITIONS.has(value.kind)) return null;
  if (value.kind === 'weekday') {
    const weekday = Number(value.value);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
    return { kind: 'weekday', value: weekday };
  }
  if (value.kind === 'planned-stress-min') {
    const minimum = Number(value.value);
    if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) return null;
    return { kind: 'planned-stress-min', value: Math.round(minimum) };
  }
  const category = text(value.value);
  return category ? { kind: 'planned-category', value: category } : null;
}

function normalizeTrial(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const recordKey = text(value.recordKey);
  const dateKey = isValidDateKey(value.dateKey) ? value.dateKey : null;
  const outcome = value.outcome === 'success' || value.outcome === 'failure' ? value.outcome : null;
  if (!recordKey || !dateKey || !outcome) return null;
  return {
    id: text(value.id, `trial-${index + 1}`),
    recordKey,
    dateKey,
    scheduleId: text(String(value.scheduleId ?? '')),
    planTitle: text(value.planTitle, '予定'),
    outcome,
    observedValue: Number.isFinite(Number(value.observedValue)) ? Number(value.observedValue) : null,
    observedLabel: text(value.observedLabel),
    capturedAt: text(value.capturedAt),
  };
}

export function normalizeExperiment(value, generatedId = 'experiment') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const condition = normalizeCondition(value.condition);
  const metricKind = VALID_METRICS.has(value.metricKind) ? value.metricKind : null;
  const startDateKey = isValidDateKey(value.startDateKey) ? value.startDateKey : null;
  const title = text(value.title);
  const action = text(value.action);
  if (!condition || !metricKind || !startDateKey || !title || !action) return null;

  const trials = [];
  const seen = new Set();
  if (Array.isArray(value.trials)) {
    value.trials.forEach((trial, index) => {
      const normalized = normalizeTrial(trial, index);
      if (!normalized || seen.has(normalized.recordKey)) return;
      seen.add(normalized.recordKey);
      trials.push(normalized);
    });
  }

  const status = VALID_STATUSES.has(value.status) ? value.status : EXPERIMENT_STATUS.ACTIVE;
  const decision = VALID_DECISIONS.has(value.decision) ? value.decision : null;

  return {
    id: text(value.id, generatedId),
    candidateId: text(value.candidateId),
    candidateType: text(value.candidateType),
    title,
    hypothesis: text(value.hypothesis),
    action,
    metricKind,
    metricLabel: text(value.metricLabel, metricKind === EXPERIMENT_METRIC.LATE_START ? '20分以上の開始遅れ' : '変更・スキップ'),
    condition,
    startDateKey,
    targetRuns: clampInteger(value.targetRuns, 3, 10, 3),
    baselineFailureRate: normalizeRate(value.baselineFailureRate),
    status,
    decision: status === EXPERIMENT_STATUS.COMPLETED ? decision : null,
    trials,
    createdAt: text(value.createdAt),
    completedAt: status === EXPERIMENT_STATUS.COMPLETED ? text(value.completedAt) : '',
  };
}

export function normalizeExperiments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const experiments = [];
  value.forEach((item, index) => {
    const experiment = normalizeExperiment(item, `experiment-${index + 1}`);
    if (!experiment || seen.has(experiment.id)) return;
    seen.add(experiment.id);
    experiments.push(experiment);
  });
  return experiments;
}

export function parseStoredExperiments(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeExperiments(parsed);
    if (!parsed || parsed.version !== EXPERIMENT_STORAGE_VERSION || !Array.isArray(parsed.experiments)) return [];
    return normalizeExperiments(parsed.experiments);
  } catch {
    return [];
  }
}

export function serializeExperiments(experiments) {
  return JSON.stringify({ version: EXPERIMENT_STORAGE_VERSION, experiments: normalizeExperiments(experiments) });
}

export function createExperimentFromCandidate(candidate, {
  id,
  startDateKey,
  action,
  targetRuns = 3,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!candidate?.experiment || !isValidDateKey(startDateKey)) return null;
  const blueprint = candidate.experiment;
  return normalizeExperiment({
    id,
    candidateId: candidate.id,
    candidateType: candidate.type,
    title: candidate.title,
    hypothesis: candidate.hypothesis,
    action: text(action, blueprint.actionSuggestion),
    metricKind: blueprint.metricKind,
    metricLabel: blueprint.metricLabel,
    condition: blueprint.condition,
    startDateKey,
    targetRuns,
    baselineFailureRate: candidate.groupRate,
    status: EXPERIMENT_STATUS.ACTIVE,
    decision: null,
    trials: [],
    createdAt,
    completedAt: '',
  }, id || 'experiment');
}

function matchesCondition(experiment, dateKey, schedule) {
  const { condition } = experiment;
  if (condition.kind === 'weekday') return weekdayIndexMondayFirst(dateKey) === condition.value;
  if (!schedule.plannedSnapshot) return false;
  if (condition.kind === 'planned-stress-min') return schedule.plannedSnapshot.plannedStress >= condition.value;
  if (condition.kind === 'planned-category') return schedule.plannedSnapshot.category === condition.value;
  return false;
}

function recordKey(dateKey, scheduleId) {
  return `${dateKey}::${String(scheduleId)}`;
}

function experimentObservation(experiment, dateKey, schedule) {
  if (experiment.metricKind === EXPERIMENT_METRIC.DEVIATION) {
    const failure = schedule.status === STATUS.CHANGED || schedule.status === STATUS.SKIPPED;
    return {
      outcome: failure ? 'failure' : 'success',
      observedValue: failure ? 1 : 0,
      observedLabel: failure ? '変更・スキップ' : '予定通り',
    };
  }

  if (
    schedule.status === STATUS.SKIPPED
    || !schedule.plannedSnapshot
    || !schedule.actualStartDateKey
    || !schedule.actualStartTime
  ) return null;
  const delta = exactStartDeltaMinutes(
    dateKey,
    schedule.plannedSnapshot.time,
    schedule.actualStartDateKey,
    schedule.actualStartTime,
  );
  if (delta === null) return null;
  const failure = delta >= 20;
  return {
    outcome: failure ? 'failure' : 'success',
    observedValue: delta,
    observedLabel: `${delta > 0 ? '+' : ''}${delta}分`,
  };
}

export function listEligibleExperimentRecords(experimentValue, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE || !isValidDateKey(throughDateKey)) return [];
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const captured = new Set(experiment.trials.map((trial) => trial.recordKey));
  const eligible = [];

  for (const [dateKey, rawSchedules] of Object.entries(sourceDays)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(rawSchedules)) continue;
    const fromStart = differenceInCalendarDays(experiment.startDateKey, dateKey);
    const toAnchor = differenceInCalendarDays(dateKey, throughDateKey);
    if (fromStart === null || toAnchor === null || fromStart < 0 || toAnchor < 0) continue;

    for (const schedule of normalizeSchedules(rawSchedules, [])) {
      if (schedule.status === STATUS.PENDING || !matchesCondition(experiment, dateKey, schedule)) continue;
      const key = recordKey(dateKey, schedule.id);
      if (captured.has(key)) continue;
      const observation = experimentObservation(experiment, dateKey, schedule);
      if (!observation) continue;
      const plan = recordedPlanForSchedule(schedule);
      eligible.push({
        recordKey: key,
        dateKey,
        scheduleId: schedule.id,
        planTitle: plan.title,
        ...observation,
      });
    }
  }

  return eligible.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.planTitle.localeCompare(b.planTitle, 'ja'));
}

export function addExperimentTrial(experimentValue, eligibleRecord, capturedAt = new Date().toISOString()) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE || !eligibleRecord?.recordKey) return experiment;
  if (experiment.trials.some((trial) => trial.recordKey === eligibleRecord.recordKey)) return experiment;
  const trial = normalizeTrial({
    id: `trial-${experiment.trials.length + 1}-${Date.now()}`,
    ...eligibleRecord,
    capturedAt,
  }, experiment.trials.length);
  if (!trial) return experiment;
  return { ...experiment, trials: [...experiment.trials, trial] };
}

export function removeExperimentTrial(experimentValue, recordKeyValue) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE) return experiment;
  return { ...experiment, trials: experiment.trials.filter((trial) => trial.recordKey !== recordKeyValue) };
}

export function calculateExperimentResult(experimentValue) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment) return null;
  const trialCount = experiment.trials.length;
  const failures = experiment.trials.filter((trial) => trial.outcome === 'failure').length;
  const successes = trialCount - failures;
  const failureRate = trialCount > 0 ? failures / trialCount : null;
  const baseline = experiment.baselineFailureRate;
  const differencePoints = failureRate === null || baseline === null
    ? null
    : Math.round((failureRate - baseline) * 100);
  const targetMet = trialCount >= experiment.targetRuns;
  let signal = 'collecting';
  if (targetMet && differencePoints !== null) {
    if (differencePoints <= -15) signal = 'improving';
    else if (differencePoints >= 15) signal = 'worsening';
    else signal = 'unclear';
  } else if (targetMet) {
    signal = 'review';
  }

  return {
    trialCount,
    successes,
    failures,
    failureRate,
    baselineFailureRate: baseline,
    differencePoints,
    targetMet,
    signal,
  };
}

export function finishExperiment(experimentValue, decision, completedAt = new Date().toISOString()) {
  const experiment = normalizeExperiment(experimentValue);
  const result = calculateExperimentResult(experiment);
  if (!experiment || !result?.targetMet || !VALID_DECISIONS.has(decision)) return experiment;
  return {
    ...experiment,
    status: EXPERIMENT_STATUS.COMPLETED,
    decision,
    completedAt,
  };
}

export function abandonExperiment(experimentValue, completedAt = new Date().toISOString()) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment) return null;
  return { ...experiment, status: EXPERIMENT_STATUS.ABANDONED, decision: null, completedAt };
}
