import { CATEGORIES, MOOD, STATUS } from '../constants.js';
import { startOfWeekDateKey } from './date.js';
import { normalizeExperiment } from './experiment.js';
import {
  calculateRetentionSummaries,
  calculateRetentionSummary,
  listRetentionUsages,
  RETENTION_ASSESSMENT_LIMIT,
  RETENTION_MIN_USES,
  RETENTION_MIN_WEEKS,
  RETENTION_SIGNAL,
} from './retention.js';
import { normalizeSchedules } from './schedule.js';

export const CONTEXT_SHIFT_MIN_SAMPLES = 6;

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return { value: null, count: 0 };
  return { value: usable.reduce((sum, value) => sum + value, 0) / usable.length, count: usable.length };
}

function rate(values) {
  const usable = values.filter((value) => value === true || value === false);
  if (usable.length === 0) return { value: null, count: 0 };
  return { value: usable.filter(Boolean).length / usable.length, count: usable.length };
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function windowSummary(usages) {
  if (!Array.isArray(usages) || usages.length === 0) {
    return { count: 0, weekCount: 0, failureRate: null, fromDateKey: null, toDateKey: null };
  }
  const failures = usages.filter((usage) => usage.outcome === 'failure').length;
  return {
    count: usages.length,
    weekCount: new Set(usages.map((usage) => startOfWeekDateKey(usage.dateKey))).size,
    failureRate: failures / usages.length,
    fromDateKey: usages[0].dateKey,
    toDateKey: usages.at(-1).dateKey,
  };
}

function rawScheduleFor(days, dateKey, scheduleId) {
  const source = days?.[dateKey];
  if (!Array.isArray(source)) return null;
  return source.find((item) => item && typeof item === 'object' && String(item.id) === String(scheduleId)) ?? null;
}

function explicitActualStress(rawSchedule) {
  if (!rawSchedule || !Object.prototype.hasOwnProperty.call(rawSchedule, 'actualStress')) return null;
  const value = Number(rawSchedule.actualStress);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function explicitMood(rawSchedule) {
  if (!rawSchedule || !Object.prototype.hasOwnProperty.call(rawSchedule, 'mood')) return null;
  return Object.values(MOOD).includes(rawSchedule.mood) ? rawSchedule.mood : null;
}

function isExperimentBuffer(experiment, schedule) {
  return Boolean(
    schedule
    && schedule.title === '調整バッファ'
    && schedule.category === '休憩'
    && Array.isArray(schedule.appliedExperimentIds)
    && schedule.appliedExperimentIds.includes(experiment.id)
  );
}

function completeDayContext(experiment, days, dateKey) {
  const rawSchedules = days?.[dateKey];
  if (!Array.isArray(rawSchedules) || rawSchedules.length === 0) return null;
  const schedules = normalizeSchedules(rawSchedules, []).filter((schedule) => !isExperimentBuffer(experiment, schedule));
  if (schedules.length === 0) return null;
  if (schedules.some((schedule) => schedule.status === STATUS.PENDING || !schedule.plannedSnapshot)) return null;

  const plans = schedules.map((schedule) => schedule.plannedSnapshot);
  const totalMinutes = plans.reduce((sum, plan) => sum + Number(plan.duration), 0);
  const averagePlannedStress = plans.reduce((sum, plan) => sum + Number(plan.plannedStress), 0) / plans.length;
  const categoryMinutes = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  plans.forEach((plan) => { categoryMinutes[plan.category] += Number(plan.duration); });
  const categoryShares = Object.fromEntries(CATEGORIES.map((category) => [
    category,
    totalMinutes > 0 ? categoryMinutes[category] / totalMinutes : 0,
  ]));

  return { dateKey, planCount: plans.length, totalMinutes, averagePlannedStress, categoryShares };
}

function targetContext(days, usage) {
  const raw = rawScheduleFor(days, usage.dateKey, usage.scheduleId);
  if (!raw) return null;
  const [schedule] = normalizeSchedules([raw], []);
  const plan = schedule?.status !== STATUS.PENDING ? schedule.plannedSnapshot : null;
  return {
    dateKey: usage.dateKey,
    plannedStress: plan ? Number(plan.plannedStress) : null,
    plannedDuration: plan ? Number(plan.duration) : null,
    actualStress: explicitActualStress(raw),
    mood: explicitMood(raw),
  };
}

function contextsForWindow(experiment, days, usages) {
  const targets = usages.map((usage) => targetContext(days, usage)).filter(Boolean);
  const dayKeys = [...new Set(usages.map((usage) => usage.dateKey))];
  const daysContext = dayKeys.map((dateKey) => completeDayContext(experiment, days, dateKey)).filter(Boolean);
  return { targets, days: daysContext };
}

function numericCandidate({ id, label, previous, recent, threshold, unit, digits = 0, note = '' }) {
  if (previous.count < CONTEXT_SHIFT_MIN_SAMPLES || recent.count < CONTEXT_SHIFT_MIN_SAMPLES || previous.value === null || recent.value === null) return null;
  const difference = recent.value - previous.value;
  if (Math.abs(difference) < threshold) return null;
  return {
    id, label, valueKind: 'number', unit,
    previousValue: round(previous.value, digits), recentValue: round(recent.value, digits), difference: round(difference, digits),
    previousSampleCount: previous.count, recentSampleCount: recent.count,
    score: Math.abs(difference) / threshold, note,
  };
}

function rateCandidate({ id, label, previous, recent, threshold = 0.2, note = '' }) {
  if (previous.count < CONTEXT_SHIFT_MIN_SAMPLES || recent.count < CONTEXT_SHIFT_MIN_SAMPLES || previous.value === null || recent.value === null) return null;
  const difference = recent.value - previous.value;
  if (Math.abs(difference) < threshold) return null;
  return {
    id, label, valueKind: 'rate', unit: '%',
    previousValue: previous.value, recentValue: recent.value, difference,
    previousSampleCount: previous.count, recentSampleCount: recent.count,
    score: Math.abs(difference) / threshold, note,
  };
}

function candidateList(experiment, days, previousUsages, recentUsages) {
  const previous = contextsForWindow(experiment, days, previousUsages);
  const recent = contextsForWindow(experiment, days, recentUsages);
  const candidates = [];
  const push = (candidate) => { if (candidate) candidates.push(candidate); };

  push(numericCandidate({ id: 'target-planned-stress', label: '対象予定の想定負荷', previous: mean(previous.targets.map((item) => item.plannedStress)), recent: mean(recent.targets.map((item) => item.plannedStress)), threshold: 10, unit: 'pt', note: '記録時に固定された対象予定のplannedSnapshotだけを比較' }));
  push(numericCandidate({ id: 'target-duration', label: '対象予定の長さ', previous: mean(previous.targets.map((item) => item.plannedDuration)), recent: mean(recent.targets.map((item) => item.plannedDuration)), threshold: 15, unit: '分', note: '記録時に固定された対象予定のplannedSnapshotだけを比較' }));
  push(numericCandidate({ id: 'actual-stress', label: '実際の負荷', previous: mean(previous.targets.map((item) => item.actualStress)), recent: mean(recent.targets.map((item) => item.actualStress)), threshold: 10, unit: 'pt', note: 'actualStressが明示記録されている回だけを比較' }));
  push(rateCandidate({ id: 'bad-mood-rate', label: '「気分が悪い」記録の割合', previous: rate(previous.targets.map((item) => item.mood === null ? null : item.mood === MOOD.BAD)), recent: rate(recent.targets.map((item) => item.mood === null ? null : item.mood === MOOD.BAD)), note: 'moodが明示記録されている回だけを比較' }));
  push(numericCandidate({ id: 'day-planned-minutes', label: '1日の予定時間', previous: mean(previous.days.map((item) => item.totalMinutes)), recent: mean(recent.days.map((item) => item.totalMinutes)), threshold: 60, unit: '分', note: '当日の全予定にimmutableなplannedSnapshotがある日だけ。実験の調整バッファは除外' }));
  push(numericCandidate({ id: 'day-plan-count', label: '1日の予定件数', previous: mean(previous.days.map((item) => item.planCount)), recent: mean(recent.days.map((item) => item.planCount)), threshold: 2, unit: '件', digits: 1, note: '当日の全予定にimmutableなplannedSnapshotがある日だけ。実験の調整バッファは除外' }));
  push(numericCandidate({ id: 'day-planned-stress', label: '1日の平均想定負荷', previous: mean(previous.days.map((item) => item.averagePlannedStress)), recent: mean(recent.days.map((item) => item.averagePlannedStress)), threshold: 10, unit: 'pt', note: '当日の全予定にimmutableなplannedSnapshotがある日だけ' }));

  CATEGORIES.forEach((category) => {
    push(rateCandidate({ id: `day-category-share-${category}`, label: `1日の「${category}」予定時間比率`, previous: mean(previous.days.map((item) => item.categoryShares[category])), recent: mean(recent.days.map((item) => item.categoryShares[category])), note: '当日の全予定にimmutableなplannedSnapshotがある日だけ。予定時間に占める比率を比較' }));
  });

  return candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'ja')).slice(0, 6);
}

export function calculateContextShiftSummary(experimentValue, days, throughDateKey) {
  const experiment = normalizeExperiment(experimentValue);
  if (!experiment) return null;
  const retention = calculateRetentionSummary(experiment, days, throughDateKey);
  if (!retention || retention.signal !== RETENTION_SIGNAL.REVIEW) return null;

  const usages = listRetentionUsages(experiment, days, throughDateKey);
  const recentUsages = usages.slice(-RETENTION_ASSESSMENT_LIMIT);
  const previousEnd = Math.max(0, usages.length - recentUsages.length);
  const previousUsages = usages.slice(Math.max(0, previousEnd - RETENTION_ASSESSMENT_LIMIT), previousEnd);
  const recentWindow = windowSummary(recentUsages);
  const previousWindow = windowSummary(previousUsages);

  if (previousWindow.count < RETENTION_MIN_USES || previousWindow.weekCount < RETENTION_MIN_WEEKS) {
    return { experimentId: experiment.id, available: false, reason: `悪化前の通常運用が${RETENTION_MIN_USES}件以上・${RETENTION_MIN_WEEKS}週以上ないため、Context Shiftを比較しません。`, previousWindow, recentWindow, candidates: [] };
  }

  if (retention.experimentFailureRate === null || previousWindow.failureRate === null || previousWindow.failureRate - retention.experimentFailureRate > 0.1) {
    return { experimentId: experiment.id, available: false, reason: '悪化前の比較窓も実験中よりすでに大きく悪化していたため、「以前は安定していた期間」とはみなさず条件差を推測しません。', previousWindow, recentWindow, candidates: [] };
  }

  const candidates = candidateList(experiment, days, previousUsages, recentUsages);
  return {
    experimentId: experiment.id,
    available: true,
    reason: candidates.length > 0 ? '以前の通常運用期と直近悪化期で、同時に変わっていた明示記録上の条件です。原因を示すものではありません。' : '比較できる記録の中では、設定した最小差を超えるContext Shift候補は見つかりませんでした。',
    previousWindow,
    recentWindow,
    candidates,
  };
}

export function calculateContextShiftSummaries(experiments, days, throughDateKey) {
  if (!Array.isArray(experiments)) return [];
  const currentReviewIds = new Set(calculateRetentionSummaries(experiments, days, throughDateKey)
    .filter((summary) => summary.signal === RETENTION_SIGNAL.REVIEW)
    .map((summary) => summary.experimentId));
  return experiments
    .filter((experiment) => currentReviewIds.has(experiment.id))
    .map((experiment) => calculateContextShiftSummary(experiment, days, throughDateKey))
    .filter(Boolean);
}
