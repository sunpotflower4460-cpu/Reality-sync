import { EXPERIMENT_STORAGE_VERSION, STATUS } from '../constants.js';
import { differenceInCalendarDays, isValidDateKey, weekdayIndexMondayFirst } from './date.js';
import { exactStartDeltaMinutes } from './analytics.js';
import { contextRuleLabel, contextRuleMatches, normalizeContextRule } from './contextRule.js';
import { normalizeSchedules, recordedPlanForSchedule } from './schedule.js';

export const EXPERIMENT_STATUS = Object.freeze({ ACTIVE: 'active', COMPLETED: 'completed', ABANDONED: 'abandoned' });
export const EXPERIMENT_DECISION = Object.freeze({ ADOPT: 'adopt', HOLD: 'hold', REJECT: 'reject' });
export const EXPERIMENT_METRIC = Object.freeze({ DEVIATION: 'deviation', LATE_START: 'late-start' });
export const PLAN_ADJUSTMENT_KIND = Object.freeze({
  BUFFER_BEFORE: 'buffer-before',
  SHORTEN_DURATION: 'shorten-duration',
  SHIFT_START_LATER: 'shift-start-later',
});

const VALID_STATUSES = new Set(Object.values(EXPERIMENT_STATUS));
const VALID_DECISIONS = new Set(Object.values(EXPERIMENT_DECISION));
const VALID_METRICS = new Set(Object.values(EXPERIMENT_METRIC));
const VALID_CONDITIONS = new Set(['weekday', 'planned-stress-min', 'planned-category']);
const VALID_ADJUSTMENTS = new Set(Object.values(PLAN_ADJUSTMENT_KIND));
const BASELINE_WINDOW_DAYS = 180;

function text(value, fallback = '') { if (typeof value !== 'string') return fallback; return value.trim() || fallback; }
function clampInteger(value, min, max, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback; }
function optionalNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeRate(value) { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null; }
function optionalId(value) { const normalized = text(value); return normalized || null; }

export function normalizePlanAdjustment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !VALID_ADJUSTMENTS.has(value.kind)) return null;
  const minutes = Number(value.minutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) return null;
  return { kind: value.kind, minutes };
}

export function planAdjustmentLabel(value) {
  const adjustment = normalizePlanAdjustment(value);
  if (!adjustment) return '計画は自動変更せず、対策文だけを再提示';
  if (adjustment.kind === PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE) return `対象予定の前に${adjustment.minutes}分の余白を追加`;
  if (adjustment.kind === PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION) return `対象予定を${adjustment.minutes}分短くする`;
  return `対象予定の開始を${adjustment.minutes}分後ろへずらす`;
}

function normalizeCondition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !VALID_CONDITIONS.has(value.kind)) return null;
  if (value.kind === 'weekday') {
    const weekday = optionalNumber(value.value);
    return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? { kind: 'weekday', value: weekday } : null;
  }
  if (value.kind === 'planned-stress-min') {
    const minimum = optionalNumber(value.value);
    return minimum !== null && minimum >= 0 && minimum <= 100 ? { kind: 'planned-stress-min', value: Math.round(minimum) } : null;
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
    id: text(value.id, `trial-${index + 1}`), recordKey, dateKey,
    scheduleId: text(String(value.scheduleId ?? '')), planTitle: text(value.planTitle, '予定'), outcome,
    observedValue: optionalNumber(value.observedValue),
    observedLabel: text(value.observedLabel), capturedAt: text(value.capturedAt),
  };
}

export function normalizeRetentionSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const throughDateKey = isValidDateKey(value.throughDateKey) ? value.throughDateKey : null;
  const failureRate = normalizeRate(value.failureRate);
  const experimentFailureRate = normalizeRate(value.experimentFailureRate);
  const assessmentCount = clampInteger(value.assessmentCount, 0, 100000, 0);
  const weekCount = clampInteger(value.weekCount, 0, 100000, 0);
  const difference = optionalNumber(value.differenceFromExperimentPoints);
  if (!throughDateKey || failureRate === null || experimentFailureRate === null || assessmentCount <= 0 || weekCount <= 0 || difference === null) return null;
  return {
    experimentId: text(value.experimentId),
    throughDateKey,
    assessmentCount,
    weekCount,
    failureRate,
    experimentFailureRate,
    differenceFromExperimentPoints: Math.max(-100, Math.min(100, Math.round(difference))),
    capturedAt: text(value.capturedAt),
  };
}

export function normalizeExperiment(value, generatedId = 'experiment') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const condition = normalizeCondition(value.condition);
  const metricKind = VALID_METRICS.has(value.metricKind) ? value.metricKind : null;
  const startDateKey = isValidDateKey(value.startDateKey) ? value.startDateKey : null;
  const title = text(value.title); const action = text(value.action);
  if (!condition || !metricKind || !startDateKey || !title || !action) return null;
  const contextRule = value.contextRule === undefined || value.contextRule === null ? null : normalizeContextRule(value.contextRule);
  if (value.contextRule !== undefined && value.contextRule !== null && !contextRule) return null;
  const trials = []; const seen = new Set();
  if (Array.isArray(value.trials)) value.trials.forEach((trial, index) => { const normalized = normalizeTrial(trial, index); if (normalized && !seen.has(normalized.recordKey)) { seen.add(normalized.recordKey); trials.push(normalized); } });
  const status = VALID_STATUSES.has(value.status) ? value.status : EXPERIMENT_STATUS.ACTIVE;
  const decision = VALID_DECISIONS.has(value.decision) ? value.decision : null;
  const id = text(value.id, generatedId);
  const parentExperimentId = optionalId(value.parentExperimentId);
  const learningRootId = text(value.learningRootId, id);
  const learningVersion = clampInteger(value.learningVersion, 1, 999, parentExperimentId ? 2 : 1);
  return {
    id, candidateId: text(value.candidateId), candidateType: text(value.candidateType),
    title, hypothesis: text(value.hypothesis), action, metricKind,
    metricLabel: text(value.metricLabel, metricKind === EXPERIMENT_METRIC.LATE_START ? '20分以上の開始遅れ' : '変更・スキップ'),
    condition, contextRule, startDateKey, targetRuns: clampInteger(value.targetRuns, 3, 10, 3),
    baselineFailureRate: normalizeRate(value.baselineFailureRate),
    baselineSampleCount: clampInteger(value.baselineSampleCount, 0, 100000, 0),
    planAdjustment: normalizePlanAdjustment(value.planAdjustment),
    learningRootId,
    parentExperimentId,
    learningVersion,
    revalidationReason: text(value.revalidationReason),
    sourceRetention: normalizeRetentionSnapshot(value.sourceRetention),
    status,
    decision: status === EXPERIMENT_STATUS.COMPLETED ? decision : null,
    decisionDateKey: status === EXPERIMENT_STATUS.COMPLETED && isValidDateKey(value.decisionDateKey) ? value.decisionDateKey : null,
    trials,
    createdAt: text(value.createdAt),
    completedAt: status === EXPERIMENT_STATUS.COMPLETED || status === EXPERIMENT_STATUS.ABANDONED ? text(value.completedAt) : '',
  };
}

export function normalizeExperiments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(); const experiments = [];
  value.forEach((item, index) => { const experiment = normalizeExperiment(item, `experiment-${index + 1}`); if (experiment && !seen.has(experiment.id)) { seen.add(experiment.id); experiments.push(experiment); } });
  return experiments;
}

export function parseStoredExperimentsResult(raw) {
  if (!raw) return { ok: true, experiments: [], unsupportedVersion: null };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, experiments: [], unsupportedVersion: null }; }

  if (Array.isArray(parsed)) {
    const experiments = normalizeExperiments(parsed);
    return experiments.length === parsed.length
      ? { ok: true, experiments, unsupportedVersion: null }
      : { ok: false, experiments: [], unsupportedVersion: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, experiments: [], unsupportedVersion: null };
  }
  if (parsed.version !== EXPERIMENT_STORAGE_VERSION) {
    return { ok: false, experiments: [], unsupportedVersion: parsed.version ?? 'unknown' };
  }
  if (!Array.isArray(parsed.experiments)) return { ok: false, experiments: [], unsupportedVersion: null };
  const experiments = normalizeExperiments(parsed.experiments);
  if (experiments.length !== parsed.experiments.length) return { ok: false, experiments: [], unsupportedVersion: null };
  return { ok: true, experiments, unsupportedVersion: null };
}

export function parseStoredExperiments(raw) { return parseStoredExperimentsResult(raw).experiments; }
export function serializeExperiments(experiments) { return JSON.stringify({ version: EXPERIMENT_STORAGE_VERSION, experiments: normalizeExperiments(experiments) }); }

export function experimentBlueprintForCandidate(candidate) {
  if (!candidate || Number(candidate.effectPoints) <= 0) return null;
  if (candidate.type === 'weekday-outcome' || candidate.type === 'weekday-late-start') {
    const index = Number(String(candidate.id).split('-').at(-1));
    if (!Number.isInteger(index) || index < 0 || index > 6) return null;
    return {
      condition: { kind: 'weekday', value: index },
      metricKind: candidate.type === 'weekday-late-start' ? EXPERIMENT_METRIC.LATE_START : EXPERIMENT_METRIC.DEVIATION,
      metricLabel: candidate.type === 'weekday-late-start' ? '20分以上の開始遅れ' : '変更・スキップ',
      actionSuggestion: '対象日の予定の前に15分の余白を置く',
      planAdjustmentSuggestion: { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 },
    };
  }
  if (candidate.type === 'planned-stress-outcome') return {
    condition: { kind: 'planned-stress-min', value: 70 }, metricKind: EXPERIMENT_METRIC.DEVIATION,
    metricLabel: '変更・スキップ', actionSuggestion: '想定負荷70以上の予定を15分短くして試す',
    planAdjustmentSuggestion: { kind: PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION, minutes: 15 },
  };
  if (candidate.type === 'category-outcome') {
    const category = String(candidate.id).replace(/^category-outcome-/, '');
    if (!category) return null;
    return {
      condition: { kind: 'planned-category', value: category }, metricKind: EXPERIMENT_METRIC.DEVIATION,
      metricLabel: '変更・スキップ', actionSuggestion: `${category}予定の前に15分の余白を置く`,
      planAdjustmentSuggestion: { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 },
    };
  }
  return null;
}
export function canCreateExperiment(candidate) { return Boolean(experimentBlueprintForCandidate(candidate)); }

export function experimentMatchesSchedule(experimentValue, dateKey, schedule, daySchedulesValue = null) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || !isValidDateKey(dateKey) || !schedule) return false;
  const { condition } = experiment;
  let baseMatch = false;
  if (condition.kind === 'weekday') baseMatch = weekdayIndexMondayFirst(dateKey) === condition.value;
  else {
    const plan = schedule.status === STATUS.PENDING ? schedule : schedule.plannedSnapshot;
    if (!plan) return false;
    if (condition.kind === 'planned-stress-min') baseMatch = plan.plannedStress >= condition.value;
    else baseMatch = condition.kind === 'planned-category' && plan.category === condition.value;
  }
  if (!baseMatch) return false;
  return !experiment.contextRule || contextRuleMatches(experiment.contextRule, schedule, daySchedulesValue);
}

function recordKey(dateKey, scheduleId) { return `${dateKey}::${String(scheduleId)}`; }
function experimentObservation(experiment, dateKey, schedule) {
  if (experiment.metricKind === EXPERIMENT_METRIC.DEVIATION) {
    const failure = schedule.status === STATUS.CHANGED || schedule.status === STATUS.SKIPPED;
    return { outcome: failure ? 'failure' : 'success', observedValue: failure ? 1 : 0, observedLabel: failure ? '変更・スキップ' : '予定通り' };
  }
  if (schedule.status === STATUS.SKIPPED || !schedule.plannedSnapshot || !schedule.actualStartDateKey || !schedule.actualStartTime) return null;
  const delta = exactStartDeltaMinutes(dateKey, schedule.plannedSnapshot.time, schedule.actualStartDateKey, schedule.actualStartTime);
  if (delta === null) return null;
  const failure = delta >= 20;
  return { outcome: failure ? 'failure' : 'success', observedValue: delta, observedLabel: `${delta > 0 ? '+' : ''}${delta}分` };
}

function historicalBaseline(days, anchorDateKey, blueprint) {
  if (!days || typeof days !== 'object' || Array.isArray(days) || !isValidDateKey(anchorDateKey)) return { rate: null, count: 0 };
  const probe = normalizeExperiment({ id: 'baseline', title: 'baseline', action: 'baseline', metricKind: blueprint.metricKind, metricLabel: blueprint.metricLabel, condition: blueprint.condition, startDateKey: anchorDateKey, targetRuns: 3, trials: [] });
  if (!probe) return { rate: null, count: 0 };
  let count = 0; let failures = 0;
  for (const [dateKey, rawSchedules] of Object.entries(days)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(rawSchedules)) continue;
    const distance = differenceInCalendarDays(dateKey, anchorDateKey);
    if (distance === null || distance < 0 || distance >= BASELINE_WINDOW_DAYS) continue;
    const schedules = normalizeSchedules(rawSchedules, []);
    for (const schedule of schedules) {
      if (schedule.status === STATUS.PENDING || !experimentMatchesSchedule(probe, dateKey, schedule, schedules)) continue;
      const observation = experimentObservation(probe, dateKey, schedule);
      if (!observation) continue;
      count += 1; if (observation.outcome === 'failure') failures += 1;
    }
  }
  return { rate: count > 0 ? failures / count : null, count };
}

export function createExperimentFromCandidate(candidate, { id, startDateKey, action, planAdjustment, targetRuns = 3, createdAt = new Date().toISOString(), days = {}, anchorDateKey = startDateKey } = {}) {
  const blueprint = experimentBlueprintForCandidate(candidate);
  if (!blueprint || !isValidDateKey(startDateKey)) return null;
  const baseline = historicalBaseline(days, anchorDateKey, blueprint);
  return normalizeExperiment({
    id, candidateId: candidate.id, candidateType: candidate.type, title: candidate.title, hypothesis: candidate.hypothesis,
    action: text(action, blueprint.actionSuggestion), metricKind: blueprint.metricKind, metricLabel: blueprint.metricLabel,
    condition: blueprint.condition, contextRule: null, startDateKey, targetRuns, baselineFailureRate: baseline.rate, baselineSampleCount: baseline.count,
    planAdjustment: planAdjustment === undefined ? blueprint.planAdjustmentSuggestion : planAdjustment,
    learningRootId: id, parentExperimentId: null, learningVersion: 1, revalidationReason: '', sourceRetention: null,
    status: EXPERIMENT_STATUS.ACTIVE, decision: null, decisionDateKey: null, trials: [], createdAt, completedAt: '',
  }, id || 'experiment');
}

export function nextLearningVersion(experiments, sourceValue) {
  const source = normalizeExperiment(sourceValue);
  if (!source) return 1;
  const rootId = source.learningRootId || source.id;
  const versions = normalizeExperiments(experiments)
    .filter((experiment) => (experiment.learningRootId || experiment.id) === rootId)
    .map((experiment) => experiment.learningVersion || 1);
  return Math.max(source.learningVersion || 1, ...versions, 0) + 1;
}

export function buildLearningLineages(experiments) {
  const groups = new Map();
  for (const experiment of normalizeExperiments(experiments)) {
    const rootId = experiment.learningRootId || experiment.id;
    const group = groups.get(rootId) ?? { rootId, title: experiment.title, versions: [] };
    group.versions.push(experiment);
    if ((experiment.learningVersion || 1) === 1) group.title = experiment.title;
    groups.set(rootId, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      versions: group.versions.sort((a, b) => (a.learningVersion || 1) - (b.learningVersion || 1) || a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => {
      const aLast = a.versions.at(-1)?.createdAt ?? '';
      const bLast = b.versions.at(-1)?.createdAt ?? '';
      return bLast.localeCompare(aLast) || a.title.localeCompare(b.title, 'ja');
    });
}

export function createRevalidationExperiment(sourceValue, retentionSummary, {
  id,
  startDateKey,
  action,
  planAdjustment,
  contextRule = null,
  contextBaseline = null,
  targetRuns = 3,
  learningVersion,
  createdAt = new Date().toISOString(),
} = {}) {
  const source = normalizeExperiment(sourceValue);
  if (
    !source
    || source.status !== EXPERIMENT_STATUS.COMPLETED
    || source.decision !== EXPERIMENT_DECISION.ADOPT
    || !source.decisionDateKey
    || !retentionSummary?.reviewCandidate
    || retentionSummary.experimentId !== source.id
    || !isValidDateKey(retentionSummary.throughDateKey)
    || !isValidDateKey(startDateKey)
    || startDateKey <= retentionSummary.throughDateKey
  ) return null;

  const snapshot = normalizeRetentionSnapshot({
    experimentId: source.id,
    throughDateKey: retentionSummary.throughDateKey,
    assessmentCount: retentionSummary.assessmentCount,
    weekCount: retentionSummary.weekCount,
    failureRate: retentionSummary.failureRate,
    experimentFailureRate: retentionSummary.experimentFailureRate,
    differenceFromExperimentPoints: retentionSummary.differenceFromExperimentPoints,
    capturedAt: createdAt,
  });
  if (!snapshot) return null;

  const normalizedRule = contextRule === null || contextRule === undefined ? null : normalizeContextRule(contextRule);
  if (contextRule !== null && contextRule !== undefined && !normalizedRule) return null;
  const contextualRate = normalizedRule ? normalizeRate(contextBaseline?.rate) : null;
  const contextualCount = normalizedRule ? clampInteger(contextBaseline?.count, 0, 100000, 0) : 0;
  const contextualWeekCount = normalizedRule ? clampInteger(contextBaseline?.weekCount, 0, 100000, 0) : 0;
  if (normalizedRule && (contextBaseline?.ok !== true || contextualRate === null || contextualCount < 4 || contextualWeekCount < 2)) return null;

  const version = clampInteger(learningVersion, 2, 999, (source.learningVersion || 1) + 1);
  const rootId = source.learningRootId || source.id;
  const ruleSuffix = normalizedRule ? `。${contextRuleLabel(normalizedRule)}に限定して再検証` : '';
  const reason = `通常運用で実験中より${snapshot.differenceFromExperimentPoints > 0 ? '+' : ''}${snapshot.differenceFromExperimentPoints}ptの悪化を観測したため再検証${ruleSuffix}`;
  return normalizeExperiment({
    id,
    candidateId: source.candidateId,
    candidateType: source.candidateType,
    title: source.title,
    hypothesis: text(source.hypothesis, source.title),
    action: text(action, source.action),
    metricKind: source.metricKind,
    metricLabel: source.metricLabel,
    condition: source.condition,
    contextRule: normalizedRule,
    startDateKey,
    targetRuns,
    baselineFailureRate: normalizedRule ? contextualRate : snapshot.failureRate,
    baselineSampleCount: normalizedRule ? contextualCount : snapshot.assessmentCount,
    planAdjustment: planAdjustment === undefined ? source.planAdjustment : planAdjustment,
    learningRootId: rootId,
    parentExperimentId: source.id,
    learningVersion: version,
    revalidationReason: reason,
    sourceRetention: snapshot,
    status: EXPERIMENT_STATUS.ACTIVE,
    decision: null,
    decisionDateKey: null,
    trials: [],
    createdAt,
    completedAt: '',
  }, id || `revalidation-${source.id}`);
}

export function listEligibleExperimentRecords(experimentValue, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE || !isValidDateKey(throughDateKey)) return [];
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const captured = new Set(experiment.trials.map((trial) => trial.recordKey)); const eligible = [];
  for (const [dateKey, rawSchedules] of Object.entries(sourceDays)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(rawSchedules)) continue;
    const fromStart = differenceInCalendarDays(experiment.startDateKey, dateKey); const toAnchor = differenceInCalendarDays(dateKey, throughDateKey);
    if (fromStart === null || toAnchor === null || fromStart < 0 || toAnchor < 0) continue;
    const schedules = normalizeSchedules(rawSchedules, []);
    for (const schedule of schedules) {
      if (schedule.status === STATUS.PENDING || !experimentMatchesSchedule(experiment, dateKey, schedule, schedules)) continue;
      const key = recordKey(dateKey, schedule.id); if (captured.has(key)) continue;
      const observation = experimentObservation(experiment, dateKey, schedule); if (!observation) continue;
      const plan = recordedPlanForSchedule(schedule);
      eligible.push({ recordKey: key, dateKey, scheduleId: schedule.id, planTitle: plan.title, ...observation });
    }
  }
  return eligible.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.planTitle.localeCompare(b.planTitle, 'ja'));
}

export function addExperimentTrial(experimentValue, eligibleRecord, capturedAt = new Date().toISOString()) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE || !eligibleRecord?.recordKey || experiment.trials.some((trial) => trial.recordKey === eligibleRecord.recordKey)) return experiment;
  const trial = normalizeTrial({ id: `trial-${experiment.trials.length + 1}-${Date.now()}`, ...eligibleRecord, capturedAt }, experiment.trials.length);
  return trial ? { ...experiment, trials: [...experiment.trials, trial] } : experiment;
}
export function removeExperimentTrial(experimentValue, key) { const experiment = normalizeExperiment(experimentValue); return !experiment || experiment.status !== EXPERIMENT_STATUS.ACTIVE ? experiment : { ...experiment, trials: experiment.trials.filter((trial) => trial.recordKey !== key) }; }

export function calculateExperimentResult(experimentValue) {
  const experiment = normalizeExperiment(experimentValue); if (!experiment) return null;
  const trialCount = experiment.trials.length; const failures = experiment.trials.filter((trial) => trial.outcome === 'failure').length; const successes = trialCount - failures;
  const failureRate = trialCount > 0 ? failures / trialCount : null; const baseline = experiment.baselineFailureRate;
  const differencePoints = failureRate === null || baseline === null ? null : Math.round((failureRate - baseline) * 100); const targetMet = trialCount >= experiment.targetRuns;
  let signal = 'collecting';
  if (targetMet && differencePoints !== null) { if (differencePoints <= -15) signal = 'improving'; else if (differencePoints >= 15) signal = 'worsening'; else signal = 'unclear'; }
  else if (targetMet) signal = 'review';
  return { trialCount, successes, failures, failureRate, baselineFailureRate: baseline, baselineSampleCount: experiment.baselineSampleCount, differencePoints, targetMet, signal };
}

export function finishExperiment(experimentValue, decision, completedAt = new Date().toISOString(), decisionDateKey = null) {
  const experiment = normalizeExperiment(experimentValue); const result = calculateExperimentResult(experiment);
  return !experiment || !result?.targetMet || !VALID_DECISIONS.has(decision)
    ? experiment
    : { ...experiment, status: EXPERIMENT_STATUS.COMPLETED, decision, decisionDateKey: isValidDateKey(decisionDateKey) ? decisionDateKey : null, completedAt };
}
export function abandonExperiment(experimentValue, completedAt = new Date().toISOString()) { const experiment = normalizeExperiment(experimentValue); return experiment ? { ...experiment, status: EXPERIMENT_STATUS.ABANDONED, decision: null, decisionDateKey: null, completedAt } : null; }
