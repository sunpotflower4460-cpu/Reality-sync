import { MOOD, STATUS } from '../constants.js';
import {
  differenceInCalendarDays,
  getMonthDateKeys,
  getWeekDateKeys,
  startOfWeekDateKey,
  weekdayIndexMondayFirst,
} from './date.js';
import {
  calculateStats,
  isValidTime,
  normalizeSchedules,
} from './schedule.js';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

function clockMinutes(time) {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function startTimeDeltaMinutes(plannedTime, actualTime) {
  const planned = clockMinutes(plannedTime);
  const actual = clockMinutes(actualTime);
  if (planned === null || actual === null) return null;
  const raw = actual - planned;
  if (Math.abs(raw) > 720) return null;
  return raw;
}

export function exactStartDeltaMinutes(plannedDateKey, plannedTime, actualDateKey, actualTime) {
  const planned = clockMinutes(plannedTime);
  const actual = clockMinutes(actualTime);
  const dayDelta = differenceInCalendarDays(plannedDateKey, actualDateKey);
  if (planned === null || actual === null || dayDelta === null) return null;
  return dayDelta * 1440 + actual - planned;
}

function sumCategoryMinutes(categories, field) {
  return Object.values(categories).reduce((sum, category) => sum + (Number(category[field]) || 0), 0);
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function createStressBucket() {
  return { count: 0, total: 0 };
}

function addStress(bucket, value) {
  if (!Number.isFinite(value)) return;
  bucket.count += 1;
  bucket.total += value;
}

function finalizeStress(bucket) {
  return {
    count: bucket.count,
    average: bucket.count > 0 ? Math.round(bucket.total / bucket.count) : null,
  };
}

function createOutcomeState() {
  return {
    categories: Object.create(null),
    reasons: new Map(),
    moodCounts: {
      [MOOD.GOOD]: 0,
      [MOOD.NORMAL]: 0,
      [MOOD.BAD]: 0,
    },
    stressByStatus: {
      [STATUS.AS_PLANNED]: createStressBucket(),
      [STATUS.CHANGED]: createStressBucket(),
      [STATUS.SKIPPED]: createStressBucket(),
    },
    totalSchedules: 0,
    recordedCount: 0,
    completed: 0,
    changed: 0,
    skipped: 0,
    pending: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
    daysWithPlans: 0,
    daysWithRecords: 0,
    untimedStartCount: 0,
    undatedStartCount: 0,
    legacyPlannedCount: 0,
    startDeltas: [],
  };
}

function mergeCategoryTotals(target, categories) {
  for (const [category, values] of Object.entries(categories)) {
    if (!target[category]) target[category] = { ideal: 0, actual: 0 };
    target[category].ideal += values.ideal;
    target[category].actual += values.actual;
  }
}

function recordScheduleObservations(state, schedule, plannedDateKey, dayDeltas) {
  if (schedule.status === STATUS.PENDING) return;

  if (!schedule.plannedSnapshot) state.legacyPlannedCount += 1;
  if (schedule.mood in state.moodCounts) state.moodCounts[schedule.mood] += 1;
  if (state.stressByStatus[schedule.status]) addStress(state.stressByStatus[schedule.status], schedule.actualStress);

  if (
    (schedule.status === STATUS.CHANGED || schedule.status === STATUS.SKIPPED)
    && typeof schedule.deviationReason === 'string'
    && schedule.deviationReason.trim()
  ) {
    const reason = schedule.deviationReason.trim();
    state.reasons.set(reason, (state.reasons.get(reason) ?? 0) + 1);
  }

  if (schedule.status !== STATUS.AS_PLANNED && schedule.status !== STATUS.CHANGED) return;

  // Exact historical timing needs both sides of history. A legacy record may
  // have an explicit actual timestamp, but without the original planned time a
  // later plan edit could change the apparent delta. Do not use today's plan as
  // a substitute for the missing historical plan.
  if (!schedule.plannedSnapshot) return;

  if (!schedule.actualStartTime) {
    state.untimedStartCount += 1;
    return;
  }
  if (!schedule.actualStartDateKey) {
    state.undatedStartCount += 1;
    return;
  }

  const delta = exactStartDeltaMinutes(
    plannedDateKey,
    schedule.plannedSnapshot.time,
    schedule.actualStartDateKey,
    schedule.actualStartTime,
  );
  if (delta === null) return;
  state.startDeltas.push(delta);
  dayDeltas.push(delta);
}

function calculateRangeInsights(days, dateKeys) {
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const state = createOutcomeState();

  const daily = dateKeys.map((dateKey) => {
    const schedules = normalizeSchedules(sourceDays[dateKey] ?? [], []);
    const stats = calculateStats(schedules);
    const dayRecorded = stats.completed + stats.changed + stats.skipped;
    const dayPlannedMinutes = sumCategoryMinutes(stats.categories, 'ideal');
    const dayActualMinutes = sumCategoryMinutes(stats.categories, 'actual');
    const dayDeltas = [];
    const beforeUntimed = state.untimedStartCount;
    const beforeUndated = state.undatedStartCount;
    const beforeLegacyPlanned = state.legacyPlannedCount;

    if (stats.total > 0) state.daysWithPlans += 1;
    if (dayRecorded > 0) state.daysWithRecords += 1;

    state.totalSchedules += stats.total;
    state.recordedCount += dayRecorded;
    state.completed += stats.completed;
    state.changed += stats.changed;
    state.skipped += stats.skipped;
    state.pending += stats.pending;
    state.plannedMinutes += dayPlannedMinutes;
    state.actualMinutes += dayActualMinutes;
    mergeCategoryTotals(state.categories, stats.categories);

    for (const schedule of schedules) recordScheduleObservations(state, schedule, dateKey, dayDeltas);

    return {
      dateKey,
      total: stats.total,
      recorded: dayRecorded,
      completed: stats.completed,
      changed: stats.changed,
      skipped: stats.skipped,
      pending: stats.pending,
      recordingRate: stats.total > 0 ? Math.round((dayRecorded / stats.total) * 100) : 0,
      asPlannedRate: dayRecorded > 0 ? Math.round((stats.completed / dayRecorded) * 100) : 0,
      plannedMinutes: dayPlannedMinutes,
      actualMinutes: dayActualMinutes,
      averageStartDelta: average(dayDeltas),
      averageAbsoluteStartDelta: average(dayDeltas.map(Math.abs)),
      startSampleCount: dayDeltas.length,
      untimedStartCount: state.untimedStartCount - beforeUntimed,
      undatedStartCount: state.undatedStartCount - beforeUndated,
      legacyPlannedCount: state.legacyPlannedCount - beforeLegacyPlanned,
    };
  });

  const reasonRanking = [...state.reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'ja'));

  return {
    dateKeys,
    daily,
    categories: state.categories,
    reasons: reasonRanking,
    moodCounts: state.moodCounts,
    stressByStatus: {
      [STATUS.AS_PLANNED]: finalizeStress(state.stressByStatus[STATUS.AS_PLANNED]),
      [STATUS.CHANGED]: finalizeStress(state.stressByStatus[STATUS.CHANGED]),
      [STATUS.SKIPPED]: finalizeStress(state.stressByStatus[STATUS.SKIPPED]),
    },
    totalSchedules: state.totalSchedules,
    recordedCount: state.recordedCount,
    completed: state.completed,
    changed: state.changed,
    skipped: state.skipped,
    pending: state.pending,
    daysWithPlans: state.daysWithPlans,
    daysWithRecords: state.daysWithRecords,
    recordingRate: state.totalSchedules > 0 ? Math.round((state.recordedCount / state.totalSchedules) * 100) : 0,
    asPlannedRate: state.recordedCount > 0 ? Math.round((state.completed / state.recordedCount) * 100) : 0,
    plannedMinutes: state.plannedMinutes,
    actualMinutes: state.actualMinutes,
    averageStartDelta: average(state.startDeltas),
    averageAbsoluteStartDelta: average(state.startDeltas.map(Math.abs)),
    startSampleCount: state.startDeltas.length,
    untimedStartCount: state.untimedStartCount,
    undatedStartCount: state.undatedStartCount,
    legacyPlannedCount: state.legacyPlannedCount,
  };
}

export function calculateWeeklyInsights(days, anchorDateKey) {
  return calculateRangeInsights(days, getWeekDateKeys(anchorDateKey));
}

function createWeekdayBucket(index) {
  return {
    index,
    label: WEEKDAY_LABELS[index],
    calendarDays: 0,
    daysWithPlans: 0,
    daysWithRecords: 0,
    total: 0,
    recorded: 0,
    completed: 0,
    changed: 0,
    skipped: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
    startDeltas: [],
  };
}

function finalizeWeekdayBucket(bucket) {
  return {
    index: bucket.index,
    label: bucket.label,
    calendarDays: bucket.calendarDays,
    daysWithPlans: bucket.daysWithPlans,
    daysWithRecords: bucket.daysWithRecords,
    total: bucket.total,
    recorded: bucket.recorded,
    completed: bucket.completed,
    changed: bucket.changed,
    skipped: bucket.skipped,
    recordingRate: bucket.total > 0 ? Math.round((bucket.recorded / bucket.total) * 100) : 0,
    asPlannedRate: bucket.recorded > 0 ? Math.round((bucket.completed / bucket.recorded) * 100) : 0,
    plannedMinutes: bucket.plannedMinutes,
    actualMinutes: bucket.actualMinutes,
    averageStartDelta: average(bucket.startDeltas),
    averageAbsoluteStartDelta: average(bucket.startDeltas.map(Math.abs)),
    startSampleCount: bucket.startDeltas.length,
  };
}

export function calculateMonthlyInsights(days, anchorDateKey) {
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const dateKeys = getMonthDateKeys(anchorDateKey);
  const range = calculateRangeInsights(sourceDays, dateKeys);
  const weekdayBuckets = Array.from({ length: 7 }, (_, index) => createWeekdayBucket(index));
  const weekMap = new Map();

  for (const day of range.daily) {
    const weekdayIndex = weekdayIndexMondayFirst(day.dateKey);
    if (weekdayIndex !== null) {
      const bucket = weekdayBuckets[weekdayIndex];
      bucket.calendarDays += 1;
      if (day.total > 0) bucket.daysWithPlans += 1;
      if (day.recorded > 0) bucket.daysWithRecords += 1;
      bucket.total += day.total;
      bucket.recorded += day.recorded;
      bucket.completed += day.completed;
      bucket.changed += day.changed;
      bucket.skipped += day.skipped;
      bucket.plannedMinutes += day.plannedMinutes;
      bucket.actualMinutes += day.actualMinutes;

      const schedules = normalizeSchedules(sourceDays[day.dateKey] ?? [], []);
      for (const schedule of schedules) {
        if (
          (schedule.status === STATUS.AS_PLANNED || schedule.status === STATUS.CHANGED)
          && schedule.plannedSnapshot
          && schedule.actualStartTime
          && schedule.actualStartDateKey
        ) {
          const delta = exactStartDeltaMinutes(day.dateKey, schedule.plannedSnapshot.time, schedule.actualStartDateKey, schedule.actualStartTime);
          if (delta !== null) bucket.startDeltas.push(delta);
        }
      }
    }

    const weekKey = startOfWeekDateKey(day.dateKey);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekKey,
        total: 0,
        recorded: 0,
        completed: 0,
        plannedMinutes: 0,
        actualMinutes: 0,
      });
    }
    const week = weekMap.get(weekKey);
    week.total += day.total;
    week.recorded += day.recorded;
    week.completed += day.completed;
    week.plannedMinutes += day.plannedMinutes;
    week.actualMinutes += day.actualMinutes;
  }

  const weeks = [...weekMap.values()].map((week) => ({
    ...week,
    recordingRate: week.total > 0 ? Math.round((week.recorded / week.total) * 100) : 0,
    asPlannedRate: week.recorded > 0 ? Math.round((week.completed / week.recorded) * 100) : 0,
  }));

  return {
    ...range,
    weekdays: weekdayBuckets.map(finalizeWeekdayBucket),
    weeks,
  };
}
