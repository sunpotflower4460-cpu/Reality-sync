import { CATEGORIES, MOOD, STATUS } from '../constants.js';

const VALID_STATUSES = new Set(Object.values(STATUS));
const VALID_MOODS = new Set(Object.values(MOOD));
const VALID_CATEGORIES = new Set(CATEGORIES);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function timeToHours(time) {
  if (!isValidTime(time)) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

export function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeCategory(value, fallback = 'その他') {
  if (VALID_CATEGORIES.has(value)) return value;
  return VALID_CATEGORIES.has(fallback) ? fallback : 'その他';
}

function normalizeId(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

export function normalizeSchedule(schedule, fallback = {}, generatedId = 'schedule') {
  const source = schedule && typeof schedule === 'object' && !Array.isArray(schedule) ? schedule : {};
  const base = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};
  const statusCandidate = source.status ?? base.status;
  const status = VALID_STATUSES.has(statusCandidate) ? statusCandidate : STATUS.PENDING;
  const duration = clampNumber(source.duration ?? base.duration ?? 0, 0, 1440);
  const plannedStress = clampNumber(source.plannedStress ?? base.plannedStress ?? 0, 0, 100);

  const normalized = {
    id: normalizeId(source.id, normalizeId(base.id, generatedId)),
    time: isValidTime(source.time) ? source.time : (isValidTime(base.time) ? base.time : '00:00'),
    title: normalizeText(source.title, normalizeText(base.title, '予定')),
    category: normalizeCategory(source.category, base.category),
    duration,
    plannedStress,
    status,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    mood: null,
    actualStress: null,
  };

  if (status === STATUS.PENDING) return normalized;

  normalized.actualStress = clampNumber(source.actualStress ?? base.actualStress ?? plannedStress, 0, 100);
  normalized.mood = VALID_MOODS.has(source.mood)
    ? source.mood
    : (VALID_MOODS.has(base.mood) ? base.mood : MOOD.NORMAL);

  if (status === STATUS.SKIPPED) {
    normalized.actualTitle = 'スキップ';
    normalized.actualDuration = 0;
    return normalized;
  }

  if (status === STATUS.AS_PLANNED) {
    normalized.actualTitle = normalized.title;
    normalized.actualDuration = clampNumber(source.actualDuration ?? base.actualDuration ?? duration, 0, 1440);
    return normalized;
  }

  const actualTitle = normalizeText(source.actualTitle, normalizeText(base.actualTitle));
  if (!actualTitle) {
    return {
      ...normalized,
      status: STATUS.PENDING,
      actualTitle: '',
      actualCategory: null,
      actualDuration: null,
      mood: null,
      actualStress: null,
    };
  }

  normalized.actualTitle = actualTitle;
  normalized.actualCategory = normalizeCategory(source.actualCategory, base.actualCategory);
  normalized.actualDuration = clampNumber(source.actualDuration ?? base.actualDuration ?? 0, 0, 1440);
  return normalized;
}

export function normalizeSchedules(schedules, fallbacks = []) {
  const fallbackList = Array.isArray(fallbacks) ? fallbacks : [];
  if (!Array.isArray(schedules)) {
    return fallbackList.map((schedule, index) => normalizeSchedule(schedule, schedule, `schedule-${index + 1}`));
  }

  const fallbackById = new Map(fallbackList.map((schedule) => [String(schedule.id), schedule]));
  const normalized = [];
  const seenIds = new Set();

  schedules.forEach((schedule, index) => {
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return;
    const fallback = fallbackById.get(String(schedule.id)) ?? fallbackList[index] ?? {};
    const item = normalizeSchedule(schedule, fallback, `schedule-${index + 1}`);
    const idKey = String(item.id);
    if (seenIds.has(idKey)) return;
    seenIds.add(idKey);
    normalized.push(item);
  });

  if (normalized.length === 0 && fallbackList.length > 0) {
    return fallbackList.map((schedule, index) => normalizeSchedule(schedule, schedule, `schedule-${index + 1}`));
  }

  return normalized;
}

export function durationAfterStatusChange(currentDuration, previousStatus, nextStatus, plannedDuration) {
  if (nextStatus === STATUS.SKIPPED) return 0;
  if (previousStatus === STATUS.SKIPPED && nextStatus !== STATUS.SKIPPED) {
    return clampNumber(plannedDuration, 0, 1440);
  }
  return clampNumber(currentDuration, 0, 1440);
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
  const list = normalizeSchedules(Array.isArray(schedules) ? schedules : []);
  const total = list.length;
  const completed = list.filter((schedule) => schedule.status === STATUS.AS_PLANNED).length;
  const changed = list.filter((schedule) => schedule.status === STATUS.CHANGED).length;
  const skipped = list.filter((schedule) => schedule.status === STATUS.SKIPPED).length;
  const pending = list.filter((schedule) => schedule.status === STATUS.PENDING).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const categories = Object.create(null);
  const ensureCategory = (category) => {
    if (!categories[category]) categories[category] = { ideal: 0, actual: 0 };
  };

  for (const schedule of list) {
    ensureCategory(schedule.category);
    categories[schedule.category].ideal += schedule.duration;

    if (schedule.status === STATUS.AS_PLANNED) {
      categories[schedule.category].actual += schedule.actualDuration ?? 0;
      continue;
    }

    if (schedule.status === STATUS.CHANGED) {
      const category = schedule.actualCategory || 'その他';
      ensureCategory(category);
      categories[category].actual += schedule.actualDuration ?? 0;
    }
  }

  return { total, completed, changed, skipped, pending, completionRate, categories };
}
