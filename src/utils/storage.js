import { CATEGORIES, MOOD, STATUS, STORAGE_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

const VALID_STATUSES = new Set(Object.values(STATUS));
const VALID_MOODS = new Set(Object.values(MOOD));
const VALID_CATEGORIES = new Set(CATEGORIES);
const STORE_FIELDS = new Set(['version', 'days']);
const SNAPSHOT_FIELDS = new Set(['time', 'title', 'category', 'duration', 'plannedStress']);
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

function storedNumberInRange(value, min, max, strictStorage) {
  if (strictStorage && typeof value !== 'number') return null;
  return finiteInRange(value, min, max);
}

function storedPlanNumberInRange(value, min, max, strictStorage) {
  const number = storedNumberInRange(value, min, max, strictStorage);
  if (number === null) return null;
  // All current plan-writing paths use whole minutes and integer stress points.
  // Keep the legacy migration permissive, but current versioned data must not
  // introduce fractional plan facts that the editor itself could never create.
  if (strictStorage && !Number.isInteger(number)) return null;
  return number;
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

function validStoredSnapshot(value, normalized, strictStorage) {
  if (value === undefined || value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !normalized) return false;
  if (Object.keys(value).some((key) => !SNAPSHOT_FIELDS.has(key))) return false;
  if (!isValidTime(value.time)) return false;
  if (typeof value.title !== 'string' || !value.title.trim()) return false;
  if (!VALID_CATEGORIES.has(value.category)) return false;
  const duration = storedPlanNumberInRange(value.duration, 0, 1440, strictStorage);
  const plannedStress = storedPlanNumberInRange(value.plannedStress, 0, 100, strictStorage);
  if (duration === null || plannedStress === null) return false;
  return normalized.time === value.time
    && normalized.title === value.title.trim()
    && normalized.category === value.category
    && normalized.duration === duration
    && normalized.plannedStress === plannedStress;
}

function optionalNumberPreserved(raw, normalized, key, min, max, strictStorage) {
  if (!hasOwn(raw, key)) return true;
  if (strictStorage) {
    if (raw[key] === null) return normalized[key] === null;
    const number = storedNumberInRange(raw[key], min, max, true);
    return number !== null && normalized[key] === number;
  }
  if (raw[key] === null || (typeof raw[key] === 'string' && raw[key].trim() === '')) return true;
  const number = storedNumberInRange(raw[key], min, max, false);
  return number !== null && normalized[key] === number;
}

function optionalTextPreserved(raw, normalized, key, strictStorage) {
  if (!hasOwn(raw, key)) return true;
  if (strictStorage) return raw[key] === normalized[key];
  if (raw[key] === null || raw[key] === '') return true;
  if (typeof raw[key] !== 'string' || !raw[key].trim()) return false;
  return normalized[key] === raw[key].trim();
}

function storedSchedulePreserved(raw, normalized, { strictStorage = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;
  if (Object.keys(raw).some((key) => !SCHEDULE_FIELDS.has(key))) return false;
  if (!validStoredId(raw.id) || normalized.id !== raw.id) return false;
  if (!isValidTime(raw.time) || normalized.time !== raw.time) return false;
  if (typeof raw.title !== 'string' || !raw.title.trim() || normalized.title !== raw.title.trim()) return false;
  if (!VALID_CATEGORIES.has(raw.category) || normalized.category !== raw.category) return false;

  const duration = storedPlanNumberInRange(raw.duration, 0, 1440, strictStorage);
  const plannedStress = storedPlanNumberInRange(raw.plannedStress, 0, 100, strictStorage);
  if (duration === null || normalized.duration !== duration) return false;
  if (plannedStress === null || normalized.plannedStress !== plannedStress) return false;
  if (!validStoredExperimentIds(raw.appliedExperimentIds, normalized.appliedExperimentIds)) return false;
  if (!VALID_STATUSES.has(raw.status) || normalized.status !== raw.status) return false;
  if (!validStoredSnapshot(raw.plannedSnapshot, normalized.plannedSnapshot, strictStorage)) return false;

  if (!optionalTextPreserved(raw, normalized, 'actualTitle', strictStorage)) return false;
  if (hasOwn(raw, 'actualCategory')) {
    if (strictStorage) {
      if (raw.actualCategory !== normalized.actualCategory) return false;
      if (raw.actualCategory !== null && !VALID_CATEGORIES.has(raw.actualCategory)) return false;
    } else if (raw.actualCategory !== null && raw.actualCategory !== '') {
      if (!VALID_CATEGORIES.has(raw.actualCategory) || normalized.actualCategory !== raw.actualCategory) return false;
    }
  }
  if (!optionalNumberPreserved(raw, normalized, 'actualDuration', 0, 1440, strictStorage)) return false;
  if (!optionalNumberPreserved(raw, normalized, 'actualStress', 0, 100, strictStorage)) return false;

  if (hasOwn(raw, 'actualStartTime')) {
    if (strictStorage) {
      if (raw.actualStartTime !== normalized.actualStartTime) return false;
      if (raw.actualStartTime !== null && !isValidTime(raw.actualStartTime)) return false;
    } else if (raw.actualStartTime !== null && raw.actualStartTime !== '') {
      if (!isValidTime(raw.actualStartTime) || normalized.actualStartTime !== raw.actualStartTime) return false;
    }
  }
  if (hasOwn(raw, 'actualStartDateKey')) {
    if (strictStorage) {
      if (raw.actualStartDateKey !== normalized.actualStartDateKey) return false;
      if (raw.actualStartDateKey !== null && !isValidDateKey(raw.actualStartDateKey)) return false;
    } else if (raw.actualStartDateKey !== null && raw.actualStartDateKey !== '') {
      if (!isValidDateKey(raw.actualStartDateKey) || normalized.actualStartDateKey !== raw.actualStartDateKey) return false;
    }
  }
  if (hasOwn(raw, 'mood')) {
    if (strictStorage) {
      if (raw.mood !== normalized.mood) return false;
      if (raw.mood !== null && !VALID_MOODS.has(raw.mood)) return false;
    } else if (raw.mood !== null && raw.mood !== '') {
      if (!VALID_MOODS.has(raw.mood) || normalized.mood !== raw.mood) return false;
    }
  }
  if (!optionalTextPreserved(raw, normalized, 'deviationReason', strictStorage)) return false;

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
  if (Object.keys(parsed).some((key) => !STORE_FIELDS.has(key))) return false;
  if (!parsed.days || typeof parsed.days !== 'object' || Array.isArray(parsed.days)) return false;
  for (const [dateKey, schedules] of Object.entries(parsed.days)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(schedules)) return false;
    const normalized = normalizeSchedules(schedules, []);
    if (normalized.length !== schedules.length) return false;
    if (schedules.some((schedule, index) => !storedSchedulePreserved(schedule, normalized[index], { strictStorage: true }))) return false;
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

function stableDay(schedules) {
  return JSON.stringify(Array.isArray(schedules) ? schedules : []);
}

export function mergeScheduleStoreWrite(latestStore, localStore, dirtyDateKeys, baseDays = {}) {
  const latest = normalizeScheduleStore(latestStore);
  const local = normalizeScheduleStore(localStore);
  const dirty = [...new Set(Array.isArray(dirtyDateKeys) ? dirtyDateKeys : [])]
    .filter(isValidDateKey);
  const conflictDateKeys = dirty.filter((dateKey) => (
    stableDay(latest.days[dateKey]) !== stableDay(baseDays[dateKey])
  ));

  if (conflictDateKeys.length > 0) {
    return { ok: false, conflictDateKeys, store: latest };
  }

  const days = { ...latest.days };
  for (const dateKey of dirty) {
    if (hasOwn(local.days, dateKey)) days[dateKey] = local.days[dateKey];
    else delete days[dateKey];
  }
  return { ok: true, conflictDateKeys: [], store: { version: STORAGE_VERSION, days } };
}

function stableSchedules(schedules) {
  return JSON.stringify(normalizeSchedules(schedules, []));
}

export function migrateLegacySchedulesResult(raw, dateKey, demoSchedules = []) {
  if (!raw) return { ok: true, store: createEmptyScheduleStore() };
  if (!isValidDateKey(dateKey)) return { ok: false, store: createEmptyScheduleStore() };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, store: createEmptyScheduleStore() };
  }

  if (!Array.isArray(parsed)) return { ok: false, store: createEmptyScheduleStore() };
  if (parsed.length === 0) return { ok: true, store: createEmptyScheduleStore() };

  const legacy = normalizeSchedules(parsed, demoSchedules);
  if (legacy.length !== parsed.length) return { ok: false, store: createEmptyScheduleStore() };
  if (parsed.some((schedule, index) => !storedSchedulePreserved(schedule, legacy[index], { strictStorage: false }))) {
    return { ok: false, store: createEmptyScheduleStore() };
  }

  const cleanDemo = normalizeSchedules(demoSchedules, demoSchedules);

  // The old demo wrote its untouched sample schedule into localStorage on mount.
  // Do not carry that synthetic content into the real product. Only migrate data
  // that differs from the pristine demo or an explicitly empty legacy list.
  if (stableSchedules(legacy) === stableSchedules(cleanDemo)) {
    return { ok: true, store: createEmptyScheduleStore() };
  }

  return {
    ok: true,
    store: {
      version: STORAGE_VERSION,
      days: { [dateKey]: legacy },
    },
  };
}

export function migrateLegacySchedules(raw, dateKey, demoSchedules = []) {
  return migrateLegacySchedulesResult(raw, dateKey, demoSchedules).store;
}
