import { CATEGORIES, MOOD, STATUS, STORAGE_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

const VALID_STATUSES = new Set(Object.values(STATUS));
const VALID_MOODS = new Set(Object.values(MOOD));
const VALID_CATEGORIES = new Set(CATEGORIES);
const SCHEDULE_FIELDS = new Set([
  'id',
  'time',
  'title',
  'category',
  'duration',
  'plannedStress',
  'appliedExperimentIds',
  'status',
  'plannedSnapshot',
  'actualTitle',
  'actualCategory',
  'actualDuration',
  'actualStartTime',
  'actualStartDateKey',
  'deviationReason',
  'mood',
  'actualStress',
]);

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function finiteInRange(value, min, max) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function validStoredId(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && Boolean(value.trim()) && value === value.trim();
}

function validStoredExperimentIds(value, normalized) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 50) return false;
  if (!Array.isArray(normalized) || normalized.length !== value.length) return false;
  return value.every((item, index) => (
    typeof item === 'string'
    && item.trim().length > 0
    && item === item.trim()
    && item === normalized[index]
  ));
}

function validStoredSnapshot(value, normalized) {
  if (value === undefined || value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !normalized) return false;
  if (!isValidTime(value.time)) return false;
  if (typeof value.title !== 'string' || !value.title.trim()) return false;
  if (!VALID_CATEGORIES.has(value.category)) return false;
  const duration = finiteInRange(value.duration, 0, 1440);
  const plannedStress = finiteInRange(value.plannedStress, 0, 100);
  if (duration === null || plannedStress === null) return false;
  return normalized.time === value.time
    && normalized.title === value.title.trim()
    && normalized.category === value.category
    && normalized.duration === duration
    && normalized.plannedStress === plannedStress;
}

function optionalNumberPreserved(raw, normalized, key, min, max) {
  if (!hasOwn(raw, key) || raw[key] === null || (typeof raw[key] === 'string' && raw[key].trim() === '')) return true;
  const number = finiteInRange(raw[key], min, max);
  return number !== null && normalized[key] === number;
}

function optionalTextPreserved(raw, normalized, key) {
  if (!hasOwn(raw, key) || raw[key] === null || raw[key] === '') return true;
  if (typeof raw[key] !== 'string' || !raw[key].trim()) return false;
  return normalized[key] === raw[key].trim();
}

function storedSchedulePreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;
  if (Object.keys(raw).some((key) => !SCHEDULE_FIELDS.has(key))) return false;
  if (!validStoredId(raw.id) || normalized.id !== raw.id) return false;
  if (!isValidTime(raw.time) || normalized.time !== raw.time) return false;
  if (typeof raw.title !== 'string' || !raw.title.trim() || normalized.title !== raw.title.trim()) return false;
  if (!VALID_CATEGORIES.has(raw.category) || normalized.category !== raw.category) return false;

  const duration = finiteInRange(raw.duration, 0, 1440);
  const plannedStress = finiteInRange(raw.plannedStress, 0, 100);
  if (duration === null || normalized.duration !== duration) return false;
  if (plannedStress === null || normalized.plannedStress !== plannedStress) return false;
  if (!validStoredExperimentIds(raw.appliedExperimentIds, normalized.appliedExperimentIds)) return false;
  if (!VALID_STATUSES.has(raw.status) || normalized.status !== raw.status) return false;
  if (!validStoredSnapshot(raw.plannedSnapshot, normalized.plannedSnapshot)) return false;

  if (!optionalTextPreserved(raw, normalized, 'actualTitle')) return false;
  if (hasOwn(raw, 'actualCategory') && raw.actualCategory !== null && raw.actualCategory !== '') {
    if (!VALID_CATEGORIES.has(raw.actualCategory) || normalized.actualCategory !== raw.actualCategory) return false;
  }
  if (!optionalNumberPreserved(raw, normalized, 'actualDuration', 0, 1440)) return false;
  if (!optionalNumberPreserved(raw, normalized, 'actualStress', 0, 100)) return false;

  if (hasOwn(raw, 'actualStartTime') && raw.actualStartTime !== null && raw.actualStartTime !== '') {
    if (!isValidTime(raw.actualStartTime) || normalized.actualStartTime !== raw.actualStartTime) return false;
  }
  if (hasOwn(raw, 'actualStartDateKey') && raw.actualStartDateKey !== null && raw.actualStartDateKey !== '') {
    if (!isValidDateKey(raw.actualStartDateKey) || normalized.actualStartDateKey !== raw.actualStartDateKey) return false;
  }
  if (hasOwn(raw, 'mood') && raw.mood !== null && raw.mood !== '') {
    if (!VALID_MOODS.has(raw.mood) || normalized.mood !== raw.mood) return false;
  }
  if (!optionalTextPreserved(raw, normalized, 'deviationReason')) return false;

  return true;
}

export function parseStoredSchedules(raw, fallbacks = []) {
  if (!raw) return normalizeSchedules(fallbacks, fallbacks);

  try {
    return normalizeSchedules(JSON.parse(raw), fallbacks);
  } catch {
    return normalizeSchedules(fallbacks, fallbacks);
  }
}

export function createEmptyScheduleStore() {
  return { version: STORAGE_VERSION, days: {} };
}

export function normalizeScheduleStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyScheduleStore();
  }
  if (value.version !== STORAGE_VERSION) return createEmptyScheduleStore();

  const sourceDays = value.days && typeof value.days === 'object' && !Array.isArray(value.days)
    ? value.days
    : {};
  const days = {};

  for (const [dateKey, schedules] of Object.entries(sourceDays)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(schedules)) continue;
    days[dateKey] = normalizeSchedules(schedules, []);
  }

  return { version: STORAGE_VERSION, days };
}

function storedScheduleShapePreserved(parsed) {
  if (!parsed.days || typeof parsed.days !== 'object' || Array.isArray(parsed.days)) return false;
  for (const [dateKey, schedules] of Object.entries(parsed.days)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(schedules)) return false;
    const normalized = normalizeSchedules(schedules, []);
    if (normalized.length !== schedules.length) return false;
    if (schedules.some((schedule, index) => !storedSchedulePreserved(schedule, normalized[index]))) return false;
  }
  return true;
}

export function parseStoredScheduleStoreResult(raw) {
  if (!raw) return { ok: true, store: createEmptyScheduleStore(), unsupportedVersion: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, store: createEmptyScheduleStore(), unsupportedVersion: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, store: createEmptyScheduleStore(), unsupportedVersion: null };
  }
  if (parsed.version !== STORAGE_VERSION) {
    return {
      ok: false,
      store: createEmptyScheduleStore(),
      unsupportedVersion: parsed.version ?? 'unknown',
    };
  }
  if (!storedScheduleShapePreserved(parsed)) {
    return { ok: false, store: createEmptyScheduleStore(), unsupportedVersion: null };
  }

  return { ok: true, store: normalizeScheduleStore(parsed), unsupportedVersion: null };
}

export function parseStoredScheduleStore(raw) {
  return parseStoredScheduleStoreResult(raw).store;
}

function stableSchedules(schedules) {
  return JSON.stringify(normalizeSchedules(schedules, []));
}

export function migrateLegacySchedules(raw, dateKey, demoSchedules = []) {
  if (!raw || !isValidDateKey(dateKey)) return createEmptyScheduleStore();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyScheduleStore();
  }

  if (!Array.isArray(parsed)) return createEmptyScheduleStore();

  const legacy = normalizeSchedules(parsed, demoSchedules);
  const cleanDemo = normalizeSchedules(demoSchedules, demoSchedules);

  // The old demo wrote its untouched sample schedule into localStorage on mount.
  // Do not carry that synthetic content into the real product. Only migrate data
  // that differs from the pristine demo or an explicitly empty legacy list.
  if (legacy.length === 0 || stableSchedules(legacy) === stableSchedules(cleanDemo)) {
    return createEmptyScheduleStore();
  }

  return {
    version: STORAGE_VERSION,
    days: { [dateKey]: legacy },
  };
}
