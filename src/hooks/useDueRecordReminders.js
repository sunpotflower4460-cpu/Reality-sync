import { useEffect, useMemo, useRef, useState } from 'react';
import { REMINDER_NOTIFIED_STORAGE_KEY, STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import {
  getDuePendingSchedules,
  normalizeNotifiedReminderKeys,
  reminderNotificationKey,
} from '../utils/reminder.js';
import { BACKUP_RESTORED_EVENT } from '../utils/restore.js';
import { parseStoredScheduleStoreResult } from '../utils/storage.js';

function readNotifiedKeys(todayKey) {
  try {
    const raw = window.localStorage.getItem(REMINDER_NOTIFIED_STORAGE_KEY);
    return normalizeNotifiedReminderKeys(raw ? JSON.parse(raw) : [], todayKey);
  } catch {
    return [];
  }
}

function writeNotifiedKeys(keys) {
  try {
    window.localStorage.setItem(REMINDER_NOTIFIED_STORAGE_KEY, JSON.stringify([...new Set(keys)]));
    return true;
  } catch {
    return false;
  }
}

function readTodaySchedules(todayKey) {
  try {
    const result = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY));
    return result.ok ? (result.store.days[todayKey] ?? []) : [];
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

export function useDueRecordReminders({ schedules, dateKey, notificationSchedules, preferences }) {
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
  const notificationSourceSchedules = useMemo(() => {
    if (Array.isArray(notificationSchedules)) return notificationSchedules;
    if (dateKey === todayKey) return schedules;
    return readTodaySchedules(todayKey);
  }, [dateKey, notificationSchedules, now, schedules, todayKey]);
  const notificationDueSchedules = useMemo(
    () => getDuePendingSchedules(notificationSourceSchedules, todayKey, now, preferences),
    [notificationSourceSchedules, now, preferences, todayKey],
  );

  useEffect(() => {
    if (!preferences.browserNotifications || notificationDueSchedules.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const sessionKeys = normalizeNotifiedReminderKeys([...sessionNotifiedRef.current], todayKey);
    sessionNotifiedRef.current = new Set(sessionKeys);
    const notified = new Set([...readNotifiedKeys(todayKey), ...sessionKeys]);
    const pendingNotifications = notificationDueSchedules.filter((schedule) => !notified.has(reminderNotificationKey(todayKey, schedule.id)));
    if (pendingNotifications.length === 0) return;

    let cancelled = false;
    const notify = async () => {
      for (const schedule of pendingNotifications) {
        if (cancelled) return;
        const key = reminderNotificationKey(todayKey, schedule.id);
        // Reserve before awaiting the OS so a focus/visibility rerender cannot
        // launch a second notification for the same schedule in parallel.
        sessionNotifiedRef.current.add(key);
        const shown = await showBrowserNotification(schedule, todayKey);
        if (!shown) {
          sessionNotifiedRef.current.delete(key);
          continue;
        }
        notified.add(key);
        // Persist when possible; the session ref remains authoritative for this
        // tab if storage is unavailable so the same alert is not sent every minute.
        writeNotifiedKeys([...notified]);
        if (cancelled) return;
      }
    };
    notify();
    return () => { cancelled = true; };
  }, [notificationDueSchedules, preferences.browserNotifications, todayKey]);

  return dueSchedules;
}
