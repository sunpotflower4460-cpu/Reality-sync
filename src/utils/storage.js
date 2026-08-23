import { STORAGE_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { normalizeSchedules } from './schedule.js';

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

  // Future storage versions must be migrated explicitly. Silently coercing an
  // unknown schema into the current one risks destroying information when the
  // normalized value is written back to localStorage.
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

export function parseStoredScheduleStore(raw) {
  if (!raw) return createEmptyScheduleStore();

  try {
    return normalizeScheduleStore(JSON.parse(raw));
  } catch {
    return createEmptyScheduleStore();
  }
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
