import { CATEGORIES, MOOD, STATUS } from '../constants.js';
import { isValidDateKey } from './date.js';

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

export function sortSchedulesByTime(schedules) {
  const list = Array.isArray(schedules) ? schedules : [];
  return [...list].sort((a, b) => timeToHours(a?.time) - timeToHours(b?.time));
}

export function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function parseActualDuration(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1440) return null;
  return parsed;
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeOptionalText(value, fallback = null) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}

function normalizeCategory(value, fallback = 'その他') {
  if (VALID_CATEGORIES.has(value)) return value;
  return VALID_CATEGORIES.has(fallback) ? fallback : 'その他';
}

function normalizeOptionalCategory(value, fallback = null) {
  if (VALID_CATEGORIES.has(value)) return value;
  return VALID_CATEGORIES.has(fallback) ? fallback : null;
}

function normalizeId(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function actualField(source, base, key) {
  return hasOwn(source, key) ? source[key] : base?.[key];
}

function normalizeOptionalNumber(value, min, max) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeAppliedExperimentIds(value, fallback = []) {
  const source = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
  const seen = new Set();
  const ids = [];
  for (const item of source) {
    const id = typeof item === 'string' ? item.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 50) break;
  }
  return ids;
}

function normalizeActualStartTime(value, fallback = null) {
  if (isValidTime(value)) return value;
  return isValidTime(fallback) ? fallback : null;
}

function normalizeActualStartDateKey(value, fallback = null) {
  if (isValidDateKey(value)) return value;
  return isValidDateKey(fallback) ? fallback : null;
}

function normalizePlannedSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!isValidTime(value.time)) return null;
  const title = normalizeText(value.title);
  if (!title || !VALID_CATEGORIES.has(value.category)) return null;
  const duration = normalizeOptionalNumber(value.duration, 0, 1440);
  const plannedStress = normalizeOptionalNumber(value.plannedStress, 0, 100);
  if (duration === null || plannedStress === null) return null;
  return {
    time: value.time,
    title,
    category: value.category,
    duration,
    plannedStress,
  };
}

export function createPlannedSnapshot(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return null;
  return normalizePlannedSnapshot({
    time: schedule.time,
    title: schedule.title,
    category: schedule.category,
    duration: schedule.duration,
    plannedStress: schedule.plannedStress,
  });
}

export function recordedPlanForSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return null;
  if (schedule.status !== STATUS.PENDING && schedule.plannedSnapshot) return schedule.plannedSnapshot;
  return {
    time: schedule.time,
    title: schedule.title,
    category: schedule.category,
    duration: schedule.duration,
    plannedStress: schedule.plannedStress,
  };
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
    appliedExperimentIds: normalizeAppliedExperimentIds(source.appliedExperimentIds, base.appliedExperimentIds),
    status,
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };

  if (status === STATUS.PENDING) return normalized;

  normalized.plannedSnapshot = normalizePlannedSnapshot(source.plannedSnapshot)
    ?? normalizePlannedSnapshot(base.plannedSnapshot);
  normalized.actualStress = normalizeOptionalNumber(actualField(source, base, 'actualStress'), 0, 100);
  const moodValue = actualField(source, base, 'mood');
  normalized.mood = VALID_MOODS.has(moodValue) ? moodValue : null;

  if (status === STATUS.SKIPPED) {
    normalized.actualTitle = 'スキップ';
    normalized.actualDuration = 0;
    normalized.actualStartTime = null;
    normalized.actualStartDateKey = null;
    normalized.deviationReason = normalizeOptionalText(source.deviationReason, base.deviationReason);
    return normalized;
  }

  normalized.actualStartTime = normalizeActualStartTime(source.actualStartTime, base.actualStartTime);
  normalized.actualStartDateKey = normalized.actualStartTime
    ? normalizeActualStartDateKey(source.actualStartDateKey, base.actualStartDateKey)
    : null;

  if (status === STATUS.AS_PLANNED) {
    const recordedTitleFallback = normalized.plannedSnapshot?.title ?? normalized.title;
    const recordedCategoryFallback = normalized.plannedSnapshot?.category ?? normalized.category;
    normalized.actualTitle = normalizeText(source.actualTitle, normalizeText(base.actualTitle, recordedTitleFallback));
    normalized.actualCategory = normalizeCategory(source.actualCategory, base.actualCategory ?? recordedCategoryFallback);
    normalized.actualDuration = normalizeOptionalNumber(actualField(source, base, 'actualDuration'), 0, 1440);
    normalized.deviationReason = null;
    return normalized;
  }

  const actualTitle = normalizeText(source.actualTitle, normalizeText(base.actualTitle));
  if (!actualTitle) {
    return {
      ...normalized,
      status: STATUS.PENDING,
      plannedSnapshot: null,
      actualTitle: '',
      actualCategory: null,
      actualDuration: null,
      actualStartTime: null,
      actualStartDateKey: null,
      deviationReason: null,
      mood: null,
      actualStress: null,
    };
  }

  normalized.actualTitle = actualTitle;
  normalized.actualCategory = normalizeOptionalCategory(source.actualCategory, base.actualCategory);
  normalized.actualDuration = normalizeOptionalNumber(actualField(source, base, 'actualDuration'), 0, 1440);
  normalized.deviationReason = normalizeOptionalText(source.deviationReason, base.deviationReason);
  return normalized;
}

export function normalizeSchedules(schedules, fallbacks = []) {
  const fallbackList = Array.isArray(fallbacks) ? fallbacks : [];
  if (!Array.isArray(schedules)) {
    return fallbackList.map((schedule, index) => normalizeSchedule(schedule, schedule, `schedule-${index + 1}`));
  }

  if (schedules.length === 0) return [];

  const fallbackById = new Map(fallbackList.map((schedule) => [String(schedule.id), schedule]));
  const normalized = [];
  const seenIds = new Set();

  schedules.forEach((schedule, index) => {
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return;
    const fallback = fallbackById.get(String(schedule.id)) ?? {};
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

export function createPendingScheduleCopy(schedule, id) {
  const normalized = normalizeSchedule(schedule, {}, id);
  return {
    id,
    time: normalized.time,
    title: normalized.title,
    category: normalized.category,
    duration: normalized.duration,
    plannedStress: normalized.plannedStress,
    appliedExperimentIds: [...normalized.appliedExperimentIds],
    status: STATUS.PENDING,
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };
}

export function durationAfterStatusChange(currentDuration, previousStatus, nextStatus, plannedDuration) {
  void plannedDuration;
  if (nextStatus === STATUS.SKIPPED) return 0;
  if (previousStatus === STATUS.SKIPPED && nextStatus !== STATUS.SKIPPED) return null;
  return parseActualDuration(currentDuration);
}

export function replacementTitleForEditing(schedule) {
  if (!schedule || schedule.status !== STATUS.CHANGED) return '';
  return normalizeText(schedule.actualTitle);
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
  let unknownActualDurationCount = 0;

  const categories = Object.create(null);
  const ensureCategory = (category) => {
    if (!categories[category]) categories[category] = { ideal: 0, actual: 0 };
  };

  for (const schedule of list) {
    const planned = recordedPlanForSchedule(schedule);
    ensureCategory(planned.category);
    categories[planned.category].ideal += planned.duration;

    if (schedule.status === STATUS.AS_PLANNED) {
      const category = schedule.actualCategory || planned.category;
      ensureCategory(category);
      if (Number.isFinite(schedule.actualDuration)) categories[category].actual += schedule.actualDuration;
      else unknownActualDurationCount += 1;
      continue;
    }

    if (schedule.status === STATUS.CHANGED) {
      const category = schedule.actualCategory || '未分類';
      ensureCategory(category);
      if (Number.isFinite(schedule.actualDuration)) categories[category].actual += schedule.actualDuration;
      else unknownActualDurationCount += 1;
    }
  }

  return { total, completed, changed, skipped, pending, completionRate, categories, unknownActualDurationCount };
}
