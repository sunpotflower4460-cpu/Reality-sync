import { STATUS } from '../constants.js';
import { dateKeyFromDate, isValidDateKey, shiftDateKey } from './date.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

export const DEFAULT_REMINDER_PREFERENCES = Object.freeze({
  enabled: true,
  delayMinutes: 15,
  browserNotifications: false,
});

export const REMINDER_DELAY_OPTIONS = Object.freeze([0, 5, 10, 15, 30, 60, 120]);
const REMINDER_FIELDS = new Set(['enabled', 'delayMinutes', 'browserNotifications']);

export function normalizeReminderPreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const numericDelay = Number(source.delayMinutes);
  const delayMinutes = REMINDER_DELAY_OPTIONS.includes(numericDelay) ? numericDelay : DEFAULT_REMINDER_PREFERENCES.delayMinutes;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_REMINDER_PREFERENCES.enabled,
    delayMinutes,
    browserNotifications: typeof source.browserNotifications === 'boolean'
      ? source.browserNotifications
      : DEFAULT_REMINDER_PREFERENCES.browserNotifications,
  };
}

function reminderPreferencesPreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (Object.keys(raw).some((key) => !REMINDER_FIELDS.has(key))) return false;
  if (raw.enabled !== undefined && (typeof raw.enabled !== 'boolean' || normalized.enabled !== raw.enabled)) return false;
  if (raw.browserNotifications !== undefined && (
    typeof raw.browserNotifications !== 'boolean'
    || normalized.browserNotifications !== raw.browserNotifications
  )) return false;
  if (raw.delayMinutes !== undefined) {
    if (typeof raw.delayMinutes !== 'number' || !REMINDER_DELAY_OPTIONS.includes(raw.delayMinutes)) return false;
    if (normalized.delayMinutes !== raw.delayMinutes) return false;
  }
  return true;
}

export function parseStoredReminderPreferencesResult(raw) {
  if (!raw) {
    return { ok: true, preferences: { ...DEFAULT_REMINDER_PREFERENCES } };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, preferences: { ...DEFAULT_REMINDER_PREFERENCES } };
  }

  const preferences = normalizeReminderPreferences(parsed);
  if (!reminderPreferencesPreserved(parsed, preferences)) {
    return { ok: false, preferences: { ...DEFAULT_REMINDER_PREFERENCES } };
  }
  return { ok: true, preferences };
}

export function parseStoredReminderPreferences(raw) {
  return parseStoredReminderPreferencesResult(raw).preferences;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeToMinutes(time) {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getDuePendingSchedules(schedules, dateKey, now = new Date(), preferences = DEFAULT_REMINDER_PREFERENCES) {
  const normalizedPreferences = normalizeReminderPreferences(preferences);
  if (!normalizedPreferences.enabled || !isValidDateKey(dateKey) || dateKey !== dateKeyFromDate(now)) return [];

  const nowMinutes = minutesSinceMidnight(now);
  return normalizeSchedules(schedules, []).filter((schedule) => {
    if (schedule.status !== STATUS.PENDING) return false;
    const plannedMinutes = timeToMinutes(schedule.time);
    if (plannedMinutes === null) return false;
    return nowMinutes >= plannedMinutes + normalizedPreferences.delayMinutes;
  });
}

export function getCarryoverDuePendingSchedules(schedules, dateKey, now = new Date(), preferences = DEFAULT_REMINDER_PREFERENCES) {
  const normalizedPreferences = normalizeReminderPreferences(preferences);
  const todayKey = dateKeyFromDate(now);
  if (
    !normalizedPreferences.enabled
    || !isValidDateKey(dateKey)
    || dateKey !== shiftDateKey(todayKey, -1)
    || normalizedPreferences.delayMinutes <= 0
  ) return [];

  const nowMinutes = minutesSinceMidnight(now);
  return normalizeSchedules(schedules, []).filter((schedule) => {
    if (schedule.status !== STATUS.PENDING) return false;
    const plannedMinutes = timeToMinutes(schedule.time);
    if (plannedMinutes === null) return false;
    const dueMinutes = plannedMinutes + normalizedPreferences.delayMinutes;
    if (dueMinutes < 1440) return false;
    return nowMinutes >= dueMinutes - 1440;
  });
}

export function reminderNotificationKey(dateKey, scheduleId) {
  return `${dateKey}:${String(scheduleId)}`;
}

export function normalizeNotifiedReminderKeys(value, todayKey) {
  if (!Array.isArray(value) || !isValidDateKey(todayKey)) return [];
  const prefix = `${todayKey}:`;
  return [...new Set(value.filter((item) => typeof item === 'string' && item.startsWith(prefix)))];
}
