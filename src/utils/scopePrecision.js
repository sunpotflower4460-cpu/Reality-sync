import { STATUS } from '../constants.js';
import { evaluateContextRule } from './contextRule.js';
import { isValidDateKey, startOfWeekDateKey } from './date.js';
import {
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  experimentMatchesSchedule,
  normalizeExperiment,
} from './experiment.js';
import { calculateRetentionSummary } from './retention.js';
import { normalizeSchedules, recordedPlanForSchedule } from './schedule.js';

export const SCOPE_PRECISION_SIGNAL = Object.freeze({
  COLLECTING: 'collecting',
  FOCUSED: 'focused',
  UNCLEAR: 'unclear',
  REVERSE: 'reverse',
  UNAVAILABLE: 'unavailable',
});

export const SCOPE_PRECISION_MIN_GROUP_USES = 4;
export const SCOPE_PRECISION_MIN_GROUP_WEEKS = 2;
export const SCOPE_PRECISION_EFFECT_POINTS = 15;

function rate(failures, count) {
  return count > 0 ? failures / count : null;
}

function sameStructuredAdjustment(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.kind === right.kind && Number(left.minutes) === Number(right.minutes);
}

function isGeneratedBuffer(schedule) {
  const plan = recordedPlanForSchedule(schedule);
  return Boolean(
    plan
    && plan.title === '調整バッファ'
    && plan.category === '休憩'
    && Array.isArray(schedule?.appliedExperimentIds)
    && schedule.appliedExperimentIds.length > 0
  );
}

function summarizeGroup(usages) {
  const failures = usages.filter((usage) => usage.outcome === 'failure').length;
  const weekCount = new Set(usages.map((usage) => startOfWeekDateKey(usage.dateKey))).size;
  return {
    count: usages.length,
    failures,
    failureRate: rate(failures, usages.length),
    weekCount,
  };
}

function sourceContrast(experiment, parent, days) {
  const sourceThroughDateKey = experiment.contextRule?.sourceThroughDateKey;
  if (!sourceThroughDateKey || !isValidDateKey(sourceThroughDateKey)) {
    return {
      signal: SCOPE_PRECISION_SIGNAL.UNAVAILABLE,
      reason: '条件を作った時点を確認できないため、条件内外の切り分けを評価しません。',
      inside: summarizeGroup([]),
      outside: summarizeGroup([]),
      unknownCount: 0,
      differencePoints: null,
      enoughData: false,
    };
  }

  const parentRetention = calculateRetentionSummary(parent, days, sourceThroughDateKey);
  if (!parentRetention || !Array.isArray(parentRetention.usages) || parentRetention.usages.length === 0) {
    return {
      signal: SCOPE_PRECISION_SIGNAL.UNAVAILABLE,
      reason: '前版の通常運用記録を確認できないため、条件内外の切り分けを評価しません。',
      inside: summarizeGroup([]),
      outside: summarizeGroup([]),
      unknownCount: 0,
      differencePoints: null,
      enoughData: false,
    };
  }

  const insideUsages = [];
  const outsideUsages = [];
  let unknownCount = 0;

  for (const usage of parentRetention.usages) {
    const rawSchedules = days?.[usage.dateKey];
    if (!Array.isArray(rawSchedules)) { unknownCount += 1; continue; }
    const schedules = normalizeSchedules(rawSchedules, []);
    const schedule = schedules.find((item) => String(item.id) === String(usage.scheduleId));
    if (!schedule) { unknownCount += 1; continue; }
    const evaluation = evaluateContextRule(experiment.contextRule, schedule, schedules);
    if (!evaluation.known) { unknownCount += 1; continue; }
    (evaluation.matches ? insideUsages : outsideUsages).push(usage);
  }

  const inside = summarizeGroup(insideUsages);
  const outside = summarizeGroup(outsideUsages);
  const enoughData = (
    inside.count >= SCOPE_PRECISION_MIN_GROUP_USES
    && outside.count >= SCOPE_PRECISION_MIN_GROUP_USES
    && inside.weekCount >= SCOPE_PRECISION_MIN_GROUP_WEEKS
    && outside.weekCount >= SCOPE_PRECISION_MIN_GROUP_WEEKS
  );
  const differencePoints = inside.failureRate === null || outside.failureRate === null
    ? null
    : Math.round((inside.failureRate - outside.failureRate) * 100);

  let signal = SCOPE_PRECISION_SIGNAL.COLLECTING;
  let reason = `前版の通常運用を条件内・条件外それぞれ${SCOPE_PRECISION_MIN_GROUP_USES}件以上・${SCOPE_PRECISION_MIN_GROUP_WEEKS}週以上確認するまで、切り分け精度を判定しません。`;

  if (enoughData && differencePoints >= SCOPE_PRECISION_EFFECT_POINTS) {
    signal = SCOPE_PRECISION_SIGNAL.FOCUSED;
    reason = `前版の通常運用では条件内の失敗率が条件外より${differencePoints}pt高く、高リスク側を切り分ける方向で観測されています。条件が原因という意味ではありません。`;
  } else if (enoughData && differencePoints <= -SCOPE_PRECISION_EFFECT_POINTS) {
    signal = SCOPE_PRECISION_SIGNAL.REVERSE;
    reason = `前版の通常運用では条件外の失敗率が条件内より${Math.abs(differencePoints)}pt高く、現在の条件が狭すぎるか向きが合っていない可能性があります。自動では条件を広げません。`;
  } else if (enoughData) {
    signal = SCOPE_PRECISION_SIGNAL.UNCLEAR;
    reason = `前版の通常運用での条件内外の差は${Math.abs(differencePoints)}ptで、条件が高リスク場面を明確に切り分けたとはまだ言えません。`;
  }

  return {
    signal,
    reason,
    inside,
    outside,
    unknownCount,
    differencePoints,
    enoughData,
    parentRetentionCount: parentRetention.assessmentCount,
    parentScopeRestricted: Boolean(parent.contextRule),
    sameStructuredAdjustmentAsParent: sameStructuredAdjustment(experiment.planAdjustment, parent.planAdjustment),
  };
}

function currentCoverage(experiment, days, throughDateKey) {
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const baseExperiment = normalizeExperiment({ ...experiment, contextRule: null });
  if (!baseExperiment || !experiment.decisionDateKey || !isValidDateKey(throughDateKey)) {
    return {
      baseConditionCount: 0,
      knownScopeCount: 0,
      insideCount: 0,
      outsideCount: 0,
      unknownCount: 0,
      insideAppliedCount: 0,
      outsideAppliedCount: 0,
      ruleCoverage: null,
      applicationCoverage: null,
    };
  }

  let baseConditionCount = 0;
  let insideCount = 0;
  let outsideCount = 0;
  let unknownCount = 0;
  let insideAppliedCount = 0;
  let outsideAppliedCount = 0;

  for (const [dateKey, rawSchedules] of Object.entries(sourceDays)) {
    if (!isValidDateKey(dateKey) || dateKey < experiment.decisionDateKey || dateKey > throughDateKey || !Array.isArray(rawSchedules)) continue;
    const schedules = normalizeSchedules(rawSchedules, []);
    for (const schedule of schedules) {
      if (schedule.status === STATUS.PENDING || isGeneratedBuffer(schedule)) continue;
      if (!experimentMatchesSchedule(baseExperiment, dateKey, schedule, schedules)) continue;
      baseConditionCount += 1;
      const evaluation = evaluateContextRule(experiment.contextRule, schedule, schedules);
      if (!evaluation.known) { unknownCount += 1; continue; }
      const applied = Array.isArray(schedule.appliedExperimentIds) && schedule.appliedExperimentIds.includes(experiment.id);
      if (evaluation.matches) {
        insideCount += 1;
        if (applied) insideAppliedCount += 1;
      } else {
        outsideCount += 1;
        if (applied) outsideAppliedCount += 1;
      }
    }
  }

  const knownScopeCount = insideCount + outsideCount;
  return {
    baseConditionCount,
    knownScopeCount,
    insideCount,
    outsideCount,
    unknownCount,
    insideAppliedCount,
    outsideAppliedCount,
    ruleCoverage: knownScopeCount > 0 ? insideCount / knownScopeCount : null,
    applicationCoverage: insideCount > 0 ? insideAppliedCount / insideCount : null,
  };
}

export function calculateScopePrecisionSummary(experimentValue, experiments, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (
    !experiment
    || experiment.status !== EXPERIMENT_STATUS.COMPLETED
    || experiment.decision !== EXPERIMENT_DECISION.ADOPT
    || !experiment.contextRule
    || !experiment.parentExperimentId
    || !experiment.decisionDateKey
    || !isValidDateKey(throughDateKey)
  ) return null;

  const parent = (Array.isArray(experiments) ? experiments : [])
    .map((item) => normalizeExperiment(item))
    .find((item) => item?.id === experiment.parentExperimentId);
  if (!parent || parent.status !== EXPERIMENT_STATUS.COMPLETED || parent.decision !== EXPERIMENT_DECISION.ADOPT) {
    return {
      experimentId: experiment.id,
      signal: SCOPE_PRECISION_SIGNAL.UNAVAILABLE,
      reason: '前版の採用済み実験を確認できないため、条件の切り分け精度を評価しません。',
      source: null,
      coverage: currentCoverage(experiment, days, throughDateKey),
    };
  }

  const source = sourceContrast(experiment, parent, days);
  return {
    experimentId: experiment.id,
    signal: source.signal,
    reason: source.reason,
    source,
    coverage: currentCoverage(experiment, days, throughDateKey),
  };
}