import { STATUS } from '../constants.js';
import { dateKeyFromDate, isValidDateKey } from './date.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

export const DEFAULT_REMINDER_PREFERENCES = Object.freeze({
  enabled: true,
  delayMinutes: 15,
  browserNotifications: false,
});

export const REMINDER_DELAY_OPTIONS = Object.freeze([0, 5, 10, 15, 30, 60, 120]);

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

export function parseStoredReminderPreferences(raw) {
  if (!raw) return { ...DEFAULT_REMINDER_PREFERENCES };
  try {
    return normalizeReminderPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_REMINDER_PREFERENCES };
  }
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

export function reminderNotificationKey(dateKey, scheduleId) {
  return `${dateKey}:${String(scheduleId)}`;
}

export function normalizeNotifiedReminderKeys(value, todayKey) {
  if (!Array.isArray(value) || !isValidDateKey(todayKey)) return [];
  const prefix = `${todayKey}:`;
  return [...new Set(value.filter((item) => typeof item === 'string' && item.startsWith(prefix)))];
}
