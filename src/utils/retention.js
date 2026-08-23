import { STATUS } from '../constants.js';
import { exactStartDeltaMinutes } from './analytics.js';
import { isValidDateKey, startOfWeekDateKey } from './date.js';
import {
  calculateExperimentResult,
  EXPERIMENT_DECISION,
  EXPERIMENT_METRIC,
  EXPERIMENT_STATUS,
  experimentMatchesSchedule,
  normalizeExperiment,
  PLAN_ADJUSTMENT_KIND,
} from './experiment.js';
import { normalizeSchedules, recordedPlanForSchedule } from './schedule.js';

export const RETENTION_SIGNAL = Object.freeze({
  COLLECTING: 'collecting',
  MAINTAINED: 'maintained',
  WATCH: 'watch',
  REVIEW: 'review',
  UNAVAILABLE: 'unavailable',
});

export const RETENTION_ASSESSMENT_LIMIT = 12;
export const RETENTION_MIN_USES = 8;
export const RETENTION_MIN_WEEKS = 3;

function wilsonInterval(failures, total, z = 1.96) {
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(failures) || failures < 0 || failures > total) return null;
  const p = failures / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function isGeneratedBufferSchedule(experiment, schedule) {
  if (experiment.planAdjustment?.kind !== PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE) return false;
  const plan = recordedPlanForSchedule(schedule);
  return Boolean(
    plan
    && plan.title === '調整バッファ'
    && plan.category === '休憩'
    && Number(plan.duration) === Number(experiment.planAdjustment.minutes)
  );
}

function retentionObservation(experiment, dateKey, schedule) {
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

export function listRetentionUsages(experimentValue, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (
    !experiment
    || experiment.status !== EXPERIMENT_STATUS.COMPLETED
    || experiment.decision !== EXPERIMENT_DECISION.ADOPT
    || !experiment.decisionDateKey
    || !isValidDateKey(throughDateKey)
  ) return [];

  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const usages = [];

  for (const [dateKey, rawSchedules] of Object.entries(sourceDays)) {
    if (!isValidDateKey(dateKey) || dateKey < experiment.decisionDateKey || dateKey > throughDateKey || !Array.isArray(rawSchedules)) continue;
    for (const schedule of normalizeSchedules(rawSchedules, [])) {
      if (schedule.status === STATUS.PENDING) continue;
      if (!Array.isArray(schedule.appliedExperimentIds) || !schedule.appliedExperimentIds.includes(experiment.id)) continue;
      if (!experimentMatchesSchedule(experiment, dateKey, schedule)) continue;
      if (isGeneratedBufferSchedule(experiment, schedule)) continue;
      const observation = retentionObservation(experiment, dateKey, schedule);
      if (!observation) continue;
      usages.push({
        recordKey: `${dateKey}::${String(schedule.id)}`,
        dateKey,
        scheduleId: schedule.id,
        planTitle: recordedPlanForSchedule(schedule)?.title ?? schedule.title,
        ...observation,
      });
    }
  }

  return usages.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.scheduleId).localeCompare(String(b.scheduleId)));
}

export function calculateRetentionSummary(experimentValue, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment || experiment.status !== EXPERIMENT_STATUS.COMPLETED || experiment.decision !== EXPERIMENT_DECISION.ADOPT) return null;

  const experimentResult = calculateExperimentResult(experiment);
  if (!experiment.decisionDateKey) {
    return {
      experimentId: experiment.id,
      throughDateKey: isValidDateKey(throughDateKey) ? throughDateKey : null,
      signal: RETENTION_SIGNAL.UNAVAILABLE,
      reviewCandidate: false,
      totalUsageCount: 0,
      assessmentCount: 0,
      weekCount: 0,
      failureRate: null,
      interval: null,
      experimentFailureRate: experimentResult?.failureRate ?? null,
      baselineFailureRate: experimentResult?.baselineFailureRate ?? null,
      differenceFromExperimentPoints: null,
      differenceFromBaselinePoints: null,
      reason: '採用日が不明な旧実験のため、通常運用の維持評価には使いません。',
      usages: [],
    };
  }

  const usages = listRetentionUsages(experiment, days, throughDateKey);
  const assessment = usages.slice(-RETENTION_ASSESSMENT_LIMIT);
  const failures = assessment.filter((usage) => usage.outcome === 'failure').length;
  const failureRate = assessment.length > 0 ? failures / assessment.length : null;
  const interval = wilsonInterval(failures, assessment.length);
  const weekCount = new Set(assessment.map((usage) => startOfWeekDateKey(usage.dateKey))).size;
  const experimentFailureRate = experimentResult?.failureRate ?? null;
  const baselineFailureRate = experimentResult?.baselineFailureRate ?? null;
  const differenceFromExperimentPoints = failureRate === null || experimentFailureRate === null
    ? null
    : Math.round((failureRate - experimentFailureRate) * 100);
  const differenceFromBaselinePoints = failureRate === null || baselineFailureRate === null
    ? null
    : Math.round((failureRate - baselineFailureRate) * 100);

  let signal = RETENTION_SIGNAL.COLLECTING;
  let reason = `通常運用を${RETENTION_MIN_USES}件以上・${RETENTION_MIN_WEEKS}週以上観測するまで判定を保留します。`;
  const enoughData = assessment.length >= RETENTION_MIN_USES && weekCount >= RETENTION_MIN_WEEKS;

  if (enoughData && experimentFailureRate === null) {
    signal = RETENTION_SIGNAL.UNAVAILABLE;
    reason = '元の小実験に比較できる失敗率がないため、維持/低下を判定しません。';
  } else if (enoughData && differenceFromExperimentPoints >= 15) {
    signal = RETENTION_SIGNAL.REVIEW;
    reason = `通常運用の失敗率が実験中より${differenceFromExperimentPoints}pt高く観測されています。採用を自動解除せず、再検証候補として扱います。`;
  } else if (enoughData && differenceFromExperimentPoints <= 10) {
    signal = RETENTION_SIGNAL.MAINTAINED;
    reason = '通常運用でも実験中から大きく悪化していない範囲で観測されています。因果の証明ではありません。';
  } else if (enoughData) {
    signal = RETENTION_SIGNAL.WATCH;
    reason = '実験中よりやや悪化していますが、見直し候補へ上げる15pt差には達していません。観測を続けます。';
  }

  return {
    experimentId: experiment.id,
    throughDateKey: isValidDateKey(throughDateKey) ? throughDateKey : null,
    signal,
    reviewCandidate: signal === RETENTION_SIGNAL.REVIEW,
    totalUsageCount: usages.length,
    assessmentCount: assessment.length,
    weekCount,
    failures,
    failureRate,
    interval,
    experimentFailureRate,
    baselineFailureRate,
    differenceFromExperimentPoints,
    differenceFromBaselinePoints,
    reason,
    usages: assessment,
  };
}

export function calculateRetentionSummaries(experiments, days, throughDateKey) {
  if (!Array.isArray(experiments)) return [];
  return experiments
    .map((experiment) => calculateRetentionSummary(experiment, days, throughDateKey))
    .filter(Boolean)
    .sort((a, b) => {
      const priority = { review: 0, watch: 1, collecting: 2, maintained: 3, unavailable: 4 };
      return (priority[a.signal] ?? 9) - (priority[b.signal] ?? 9) || b.totalUsageCount - a.totalUsageCount;
    });
}
