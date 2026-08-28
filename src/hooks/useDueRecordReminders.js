import { useEffect, useMemo, useRef, useState } from 'react';
import { REMINDER_NOTIFIED_STORAGE_KEY, STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate, shiftDateKey } from '../utils/date.js';
import {
  getCarryoverDuePendingSchedules,
  getDuePendingSchedules,
  normalizeNotifiedReminderKeys,
  reminderNotificationKey,
} from '../utils/reminder.js';
import { BACKUP_RESTORED_EVENT } from '../utils/restore.js';
import { parseStoredScheduleStoreResult } from '../utils/storage.js';

function normalizedStoredNotificationKeys(rawValue, dateKeys) {
  let parsed;
  try {
    parsed = rawValue ? JSON.parse(rawValue) : [];
  } catch {
    parsed = [];
  }
  return [...new Set(dateKeys.flatMap((dateKey) => normalizeNotifiedReminderKeys(parsed, dateKey)))];
}

function readNotifiedKeys(dateKeys) {
  try {
    return normalizedStoredNotificationKeys(
      window.localStorage.getItem(REMINDER_NOTIFIED_STORAGE_KEY),
      dateKeys,
    );
  } catch {
    return [];
  }
}

function writeNotifiedKeys(keys, dateKeys) {
  try {
    // Merge with the latest retained keys immediately before writing. Without
    // this, two tabs notifying different schedules can each overwrite the
    // other's dedupe key and make a previously shown notification eligible
    // again on a later pass.
    const latest = normalizedStoredNotificationKeys(
      window.localStorage.getItem(REMINDER_NOTIFIED_STORAGE_KEY),
      dateKeys,
    );
    const merged = [...new Set([...latest, ...keys])];
    window.localStorage.setItem(REMINDER_NOTIFIED_STORAGE_KEY, JSON.stringify(merged));
    const readBack = normalizedStoredNotificationKeys(
      window.localStorage.getItem(REMINDER_NOTIFIED_STORAGE_KEY),
      dateKeys,
    );
    return merged.every((key) => readBack.includes(key));
  } catch {
    return false;
  }
}

function readSchedulesForDate(dateKey) {
  try {
    const result = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY));
    return result.ok ? (result.store.days[dateKey] ?? []) : [];
  } catch {
    return [];
  }
}

async function showBrowserNotification(schedule, dateKey) {
  const title = 'RealitySync — 記録待ち';
  const options = {
    body: `${schedule.time}「${schedule.title}」の実績がまだ未記録です。`,
    tag: `reality-sync:${dateKey}:${String(schedule.id)}`,
    renotify: false,
    data: { url: './' },
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
    } catch {
      // Fall back to a window notification when supported.
    }
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function useDueRecordReminders({ schedules, dateKey, scheduleDays, preferences }) {
  const [now, setNow] = useState(() => new Date());
  const sessionNotifiedRef = useRef(new Set());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const intervalId = window.setInterval(refresh, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const resetAfterRestore = () => {
      sessionNotifiedRef.current.clear();
      setNow(new Date());
    };
    window.addEventListener(BACKUP_RESTORED_EVENT, resetAfterRestore);
    return () => window.removeEventListener(BACKUP_RESTORED_EVENT, resetAfterRestore);
  }, []);

  const dueSchedules = useMemo(
    () => getDuePendingSchedules(schedules, dateKey, now, preferences),
    [dateKey, now, preferences, schedules],
  );
  const todayKey = dateKeyFromDate(now);
  const previousDateKey = shiftDateKey(todayKey, -1);
  const schedulesForDate = (targetDateKey) => {
    if (dateKey === targetDateKey) return schedules;
    const inMemory = scheduleDays?.[targetDateKey];
    if (Array.isArray(inMemory)) return inMemory;
    return readSchedulesForDate(targetDateKey);
  };
  const todaySchedules = useMemo(
    () => schedulesForDate(todayKey),
    [dateKey, scheduleDays, schedules, todayKey],
  );
  const previousSchedules = useMemo(
    () => schedulesForDate(previousDateKey),
    [dateKey, previousDateKey, scheduleDays, schedules],
  );
  const notificationCandidates = useMemo(() => [
    ...getDuePendingSchedules(todaySchedules, todayKey, now, preferences)
      .map((schedule) => ({ dateKey: todayKey, schedule })),
    ...getCarryoverDuePendingSchedules(previousSchedules, previousDateKey, now, preferences)
      .map((schedule) => ({ dateKey: previousDateKey, schedule })),
  ], [now, preferences, previousDateKey, previousSchedules, todayKey, todaySchedules]);

  useEffect(() => {
    if (!preferences.browserNotifications || notificationCandidates.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const retainedDateKeys = [todayKey, previousDateKey];
    const sessionKeys = retainedDateKeys.flatMap((key) => (
      normalizeNotifiedReminderKeys([...sessionNotifiedRef.current], key)
    ));
    sessionNotifiedRef.current = new Set(sessionKeys);
    const notified = new Set([...readNotifiedKeys(retainedDateKeys), ...sessionKeys]);
    const pendingNotifications = notificationCandidates.filter(({ dateKey: sourceDateKey, schedule }) => (
      !notified.has(reminderNotificationKey(sourceDateKey, schedule.id))
    ));
    if (pendingNotifications.length === 0) return;

    let cancelled = false;
    const notify = async () => {
      for (const { dateKey: sourceDateKey, schedule } of pendingNotifications) {
        if (cancelled) return;
        const key = reminderNotificationKey(sourceDateKey, schedule.id);
        // Reserve before awaiting the OS so a focus/visibility rerender cannot
        // launch a second notification for the same schedule in parallel.
        sessionNotifiedRef.current.add(key);
        const shown = await showBrowserNotification(schedule, sourceDateKey);
        if (!shown) {
          sessionNotifiedRef.current.delete(key);
          continue;
        }
        notified.add(key);
        // Persist when possible; the session ref remains authoritative for this
        // tab if storage is unavailable so the same alert is not sent every minute.
        // The write helper merges retained keys from other tabs before replacing
        // the bounded today/yesterday cache.
        writeNotifiedKeys([...notified], retainedDateKeys);
        if (cancelled) return;
      }
    };
    notify();
    return () => { cancelled = true; };
  }, [notificationCandidates, preferences.browserNotifications, previousDateKey, todayKey]);

  return dueSchedules;
}
