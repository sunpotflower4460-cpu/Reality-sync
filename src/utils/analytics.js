import { MOOD, STATUS } from '../constants.js';
import { getWeekDateKeys } from './date.js';
import { calculateStats, isValidTime, normalizeSchedules } from './schedule.js';

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
  // RealitySync currently stores an actual clock time but not an actual date.
  // A very large clock difference can be a midnight crossover in either
  // direction, so do not guess whether it means early or late.
  if (Math.abs(raw) > 720) return null;
  return raw;
}

function sumCategoryMinutes(categories, field) {
  return Object.values(categories).reduce((sum, category) => sum + (Number(category[field]) || 0), 0);
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function createStressBucket() {
  return { count: 0, total: 0, average: null };
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

export function calculateWeeklyInsights(days, anchorDateKey) {
  const sourceDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  const dateKeys = getWeekDateKeys(anchorDateKey);
  const categories = Object.create(null);
  const reasons = new Map();
  const moodCounts = {
    [MOOD.GOOD]: 0,
    [MOOD.NORMAL]: 0,
    [MOOD.BAD]: 0,
  };
  const stressByStatus = {
    [STATUS.AS_PLANNED]: createStressBucket(),
    [STATUS.CHANGED]: createStressBucket(),
    [STATUS.SKIPPED]: createStressBucket(),
  };

  let totalSchedules = 0;
  let recordedCount = 0;
  let completed = 0;
  let changed = 0;
  let skipped = 0;
  let pending = 0;
  let plannedMinutes = 0;
  let actualMinutes = 0;
  let daysWithPlans = 0;
  let daysWithRecords = 0;
  let untimedStartCount = 0;
  let ambiguousStartCount = 0;
  const startDeltas = [];

  const daily = dateKeys.map((dateKey) => {
    const schedules = normalizeSchedules(sourceDays[dateKey] ?? [], []);
    const stats = calculateStats(schedules);
    const dayRecorded = stats.completed + stats.changed + stats.skipped;
    const dayPlannedMinutes = sumCategoryMinutes(stats.categories, 'ideal');
    const dayActualMinutes = sumCategoryMinutes(stats.categories, 'actual');
    const dayDeltas = [];
    let dayUntimed = 0;
    let dayAmbiguous = 0;

    if (stats.total > 0) daysWithPlans += 1;
    if (dayRecorded > 0) daysWithRecords += 1;

    totalSchedules += stats.total;
    recordedCount += dayRecorded;
    completed += stats.completed;
    changed += stats.changed;
    skipped += stats.skipped;
    pending += stats.pending;
    plannedMinutes += dayPlannedMinutes;
    actualMinutes += dayActualMinutes;

    for (const [category, values] of Object.entries(stats.categories)) {
      if (!categories[category]) categories[category] = { ideal: 0, actual: 0 };
      categories[category].ideal += values.ideal;
      categories[category].actual += values.actual;
    }

    for (const schedule of schedules) {
      if (schedule.status === STATUS.PENDING) continue;

      if (schedule.mood in moodCounts) moodCounts[schedule.mood] += 1;
      if (stressByStatus[schedule.status]) addStress(stressByStatus[schedule.status], schedule.actualStress);

      if (
        (schedule.status === STATUS.CHANGED || schedule.status === STATUS.SKIPPED)
        && typeof schedule.deviationReason === 'string'
        && schedule.deviationReason.trim()
      ) {
        const reason = schedule.deviationReason.trim();
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }

      if (schedule.status === STATUS.AS_PLANNED || schedule.status === STATUS.CHANGED) {
        if (!schedule.actualStartTime) {
          untimedStartCount += 1;
          dayUntimed += 1;
          continue;
        }
        const delta = startTimeDeltaMinutes(schedule.time, schedule.actualStartTime);
        if (delta === null) {
          ambiguousStartCount += 1;
          dayAmbiguous += 1;
          continue;
        }
        startDeltas.push(delta);
        dayDeltas.push(delta);
      }
    }

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
      untimedStartCount: dayUntimed,
      ambiguousStartCount: dayAmbiguous,
    };
  });

  const reasonRanking = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'ja'));

  return {
    dateKeys,
    daily,
    categories,
    reasons: reasonRanking,
    moodCounts,
    stressByStatus: {
      [STATUS.AS_PLANNED]: finalizeStress(stressByStatus[STATUS.AS_PLANNED]),
      [STATUS.CHANGED]: finalizeStress(stressByStatus[STATUS.CHANGED]),
      [STATUS.SKIPPED]: finalizeStress(stressByStatus[STATUS.SKIPPED]),
    },
    totalSchedules,
    recordedCount,
    completed,
    changed,
    skipped,
    pending,
    daysWithPlans,
    daysWithRecords,
    recordingRate: totalSchedules > 0 ? Math.round((recordedCount / totalSchedules) * 100) : 0,
    asPlannedRate: recordedCount > 0 ? Math.round((completed / recordedCount) * 100) : 0,
    plannedMinutes,
    actualMinutes,
    averageStartDelta: average(startDeltas),
    averageAbsoluteStartDelta: average(startDeltas.map(Math.abs)),
    startSampleCount: startDeltas.length,
    untimedStartCount,
    ambiguousStartCount,
  };
}
