import { CATEGORIES, STATUS } from '../constants.js';
import { isValidDateKey, startOfWeekDateKey } from './date.js';
import { normalizeSchedules } from './schedule.js';

export const CONTEXT_RULE_METRIC = Object.freeze({
  TARGET_PLANNED_STRESS: 'target-planned-stress',
  TARGET_DURATION: 'target-duration',
  DAY_PLANNED_MINUTES: 'day-planned-minutes',
  DAY_PLAN_COUNT: 'day-plan-count',
  DAY_PLANNED_STRESS: 'day-planned-stress',
  DAY_CATEGORY_SHARE: 'day-category-share',
});

export const CONTEXT_RULE_MIN_BASELINE_USES = 4;
export const CONTEXT_RULE_MIN_BASELINE_WEEKS = 2;

const VALID_METRICS = new Set(Object.values(CONTEXT_RULE_METRIC));
const VALID_OPERATORS = new Set(['gte', 'lte']);

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value, digits = 0) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function thresholdRange(metric) {
  if (metric === CONTEXT_RULE_METRIC.TARGET_PLANNED_STRESS || metric === CONTEXT_RULE_METRIC.DAY_PLANNED_STRESS) return [0, 100];
  if (metric === CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE) return [0, 1];
  if (metric === CONTEXT_RULE_METRIC.DAY_PLAN_COUNT) return [0, 100];
  if (metric === CONTEXT_RULE_METRIC.TARGET_DURATION) return [0, 1440];
  return [0, 10080];
}

export function normalizeContextRule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !VALID_METRICS.has(value.metric) || !VALID_OPERATORS.has(value.operator)) return null;
  const threshold = finite(value.threshold);
  if (threshold === null) return null;
  const [minimum, maximum] = thresholdRange(value.metric);
  if (threshold < minimum || threshold > maximum) return null;
  const category = value.metric === CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE
    ? (CATEGORIES.includes(value.category) ? value.category : null)
    : null;
  if (value.metric === CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE && !category) return null;
  const sourcePreviousValue = finite(value.sourcePreviousValue);
  const sourceRecentValue = finite(value.sourceRecentValue);
  const sourceThroughDateKey = isValidDateKey(value.sourceThroughDateKey) ? value.sourceThroughDateKey : null;
  const sourceCandidateId = typeof value.sourceCandidateId === 'string' && value.sourceCandidateId.trim() ? value.sourceCandidateId.trim() : '';
  if (!sourceCandidateId || sourcePreviousValue === null || sourceRecentValue === null || !sourceThroughDateKey) return null;
  return {
    metric: value.metric,
    operator: value.operator,
    threshold,
    category,
    sourceCandidateId,
    sourcePreviousValue,
    sourceRecentValue,
    sourceThroughDateKey,
  };
}

function metricLabel(rule) {
  if (rule.metric === CONTEXT_RULE_METRIC.TARGET_PLANNED_STRESS) return '対象予定の想定負荷';
  if (rule.metric === CONTEXT_RULE_METRIC.TARGET_DURATION) return '対象予定の長さ';
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLANNED_MINUTES) return '1日の予定時間';
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLAN_COUNT) return '1日の予定件数';
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLANNED_STRESS) return '1日の平均想定負荷';
  return `1日の「${rule.category}」予定時間比率`;
}

function formattedThreshold(rule) {
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE) return `${Math.round(rule.threshold * 100)}%`;
  if (rule.metric === CONTEXT_RULE_METRIC.TARGET_DURATION || rule.metric === CONTEXT_RULE_METRIC.DAY_PLANNED_MINUTES) return `${Math.round(rule.threshold)}分`;
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLAN_COUNT) return `${rounded(rule.threshold, 1)}件`;
  return `${Math.round(rule.threshold)}pt`;
}

export function contextRuleLabel(value) {
  const rule = normalizeContextRule(value);
  if (!rule) return '条件なし';
  return `${metricLabel(rule)}が${formattedThreshold(rule)}${rule.operator === 'gte' ? '以上' : '以下'}の時だけ`;
}

export function contextRuleForShiftCandidate(candidate, throughDateKey) {
  if (!candidate || !isValidDateKey(throughDateKey)) return null;
  const previous = finite(candidate.previousValue);
  const recent = finite(candidate.recentValue);
  if (previous === null || recent === null || previous === recent) return null;

  let metric = null;
  let category = null;
  if (candidate.id === 'target-planned-stress') metric = CONTEXT_RULE_METRIC.TARGET_PLANNED_STRESS;
  else if (candidate.id === 'target-duration') metric = CONTEXT_RULE_METRIC.TARGET_DURATION;
  else if (candidate.id === 'day-planned-minutes') metric = CONTEXT_RULE_METRIC.DAY_PLANNED_MINUTES;
  else if (candidate.id === 'day-plan-count') metric = CONTEXT_RULE_METRIC.DAY_PLAN_COUNT;
  else if (candidate.id === 'day-planned-stress') metric = CONTEXT_RULE_METRIC.DAY_PLANNED_STRESS;
  else if (String(candidate.id).startsWith('day-category-share-')) {
    metric = CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE;
    category = String(candidate.id).replace(/^day-category-share-/, '');
    if (!CATEGORIES.includes(category)) return null;
  } else return null;

  const midpoint = (previous + recent) / 2;
  const threshold = metric === CONTEXT_RULE_METRIC.DAY_CATEGORY_SHARE
    ? rounded(midpoint, 2)
    : metric === CONTEXT_RULE_METRIC.DAY_PLAN_COUNT
      ? rounded(midpoint, 1)
      : Math.round(midpoint);

  return normalizeContextRule({
    metric,
    operator: recent > previous ? 'gte' : 'lte',
    threshold,
    category,
    sourceCandidateId: candidate.id,
    sourcePreviousValue: previous,
    sourceRecentValue: recent,
    sourceThroughDateKey: throughDateKey,
  });
}

export function planKnowableContextShiftCandidates(summary) {
  if (!summary?.available || !Array.isArray(summary.candidates)) return [];
  return summary.candidates.filter((candidate) => Boolean(contextRuleForShiftCandidate(candidate, summary.recentWindow?.toDateKey)));
}

function isGeneratedBuffer(schedule) {
  return Boolean(
    schedule
    && schedule.title === '調整バッファ'
    && schedule.category === '休憩'
    && Array.isArray(schedule.appliedExperimentIds)
    && schedule.appliedExperimentIds.length > 0
  );
}

function planForSchedule(schedule) {
  if (!schedule) return null;
  if (schedule.status === STATUS.PENDING) return schedule;
  return schedule.plannedSnapshot ?? null;
}

function fullDayPlanContext(daySchedulesValue) {
  const schedules = normalizeSchedules(daySchedulesValue, []).filter((schedule) => !isGeneratedBuffer(schedule));
  if (schedules.length === 0) return null;
  const plans = [];
  for (const schedule of schedules) {
    const plan = planForSchedule(schedule);
    if (!plan) return null;
    plans.push(plan);
  }
  const totalMinutes = plans.reduce((sum, plan) => sum + Number(plan.duration), 0);
  const planCount = plans.length;
  const averagePlannedStress = plans.reduce((sum, plan) => sum + Number(plan.plannedStress), 0) / planCount;
  const categoryMinutes = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  plans.forEach((plan) => { categoryMinutes[plan.category] += Number(plan.duration); });
  return {
    totalMinutes,
    planCount,
    averagePlannedStress,
    categoryShares: Object.fromEntries(CATEGORIES.map((category) => [category, totalMinutes > 0 ? categoryMinutes[category] / totalMinutes : 0])),
  };
}

function contextValue(rule, schedule, daySchedulesValue) {
  const plan = planForSchedule(schedule);
  if (!plan) return null;
  if (rule.metric === CONTEXT_RULE_METRIC.TARGET_PLANNED_STRESS) return Number(plan.plannedStress);
  if (rule.metric === CONTEXT_RULE_METRIC.TARGET_DURATION) return Number(plan.duration);
  const day = fullDayPlanContext(daySchedulesValue);
  if (!day) return null;
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLANNED_MINUTES) return day.totalMinutes;
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLAN_COUNT) return day.planCount;
  if (rule.metric === CONTEXT_RULE_METRIC.DAY_PLANNED_STRESS) return day.averagePlannedStress;
  return day.categoryShares[rule.category];
}

export function contextRuleMatches(ruleValue, schedule, daySchedulesValue) {
  const rule = normalizeContextRule(ruleValue);
  if (!rule || !schedule) return false;
  const value = contextValue(rule, schedule, daySchedulesValue);
  if (!Number.isFinite(value)) return false;
  return rule.operator === 'gte' ? value >= rule.threshold : value <= rule.threshold;
}

export function buildContextualRetentionBaseline(ruleValue, retentionSummary, days) {
  const rule = normalizeContextRule(ruleValue);
  if (!rule || !retentionSummary?.reviewCandidate || !Array.isArray(retentionSummary.usages) || !days || typeof days !== 'object' || Array.isArray(days)) {
    return { ok: false, rate: null, count: 0, weekCount: 0, reason: '条件付き比較基準を作れません。' };
  }
  const matching = [];
  for (const usage of retentionSummary.usages) {
    const rawSchedules = days[usage.dateKey];
    if (!Array.isArray(rawSchedules)) continue;
    const schedules = normalizeSchedules(rawSchedules, []);
    const schedule = schedules.find((item) => String(item.id) === String(usage.scheduleId));
    if (!schedule || !contextRuleMatches(rule, schedule, schedules)) continue;
    matching.push(usage);
  }
  const weekCount = new Set(matching.map((usage) => startOfWeekDateKey(usage.dateKey))).size;
  if (matching.length < CONTEXT_RULE_MIN_BASELINE_USES || weekCount < CONTEXT_RULE_MIN_BASELINE_WEEKS) {
    return {
      ok: false,
      rate: null,
      count: matching.length,
      weekCount,
      reason: `条件に一致する直近通常運用が${CONTEXT_RULE_MIN_BASELINE_USES}件以上・${CONTEXT_RULE_MIN_BASELINE_WEEKS}週以上必要です。`,
    };
  }
  const failures = matching.filter((usage) => usage.outcome === 'failure').length;
  return {
    ok: true,
    rate: failures / matching.length,
    count: matching.length,
    weekCount,
    failures,
    reason: '条件に一致した直近通常運用だけを、新しい条件付きバージョンの比較基準にします。',
  };
}
