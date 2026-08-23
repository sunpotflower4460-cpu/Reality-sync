import { STATUS } from '../constants.js';

export function timeToHours(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours + minutes / 60;
}

export function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function formatTime(mins) {
  const safeMinutes = Math.max(0, Math.round(Number(mins) || 0));
  if (safeMinutes === 0) return '0分';
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function calculateStats(schedules) {
  const list = Array.isArray(schedules) ? schedules : [];
  const total = list.length;
  const completed = list.filter((schedule) => schedule.status === STATUS.AS_PLANNED).length;
  const changed = list.filter((schedule) => schedule.status === STATUS.CHANGED).length;
  const skipped = list.filter((schedule) => schedule.status === STATUS.SKIPPED).length;
  const pending = list.filter((schedule) => schedule.status === STATUS.PENDING).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const categories = {};
  const ensureCategory = (category) => {
    if (!categories[category]) categories[category] = { ideal: 0, actual: 0 };
  };

  for (const schedule of list) {
    ensureCategory(schedule.category);
    categories[schedule.category].ideal += Math.max(0, Number(schedule.duration) || 0);

    if (schedule.status === STATUS.AS_PLANNED) {
      categories[schedule.category].actual += Math.max(0, Number(schedule.actualDuration ?? schedule.duration) || 0);
      continue;
    }

    if (schedule.status === STATUS.CHANGED) {
      const category = schedule.actualCategory || 'その他';
      ensureCategory(category);
      categories[category].actual += Math.max(0, Number(schedule.actualDuration) || 0);
    }

    // SKIPPED intentionally adds 0 actual minutes. We do not invent rest time
    // from the planned duration when no actual duration was recorded.
  }

  return { total, completed, changed, skipped, pending, completionRate, categories };
}
