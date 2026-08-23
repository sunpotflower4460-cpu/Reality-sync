import { useEffect, useMemo, useState } from 'react';
import { REMINDER_NOTIFIED_STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import {
  getDuePendingSchedules,
  normalizeNotifiedReminderKeys,
  reminderNotificationKey,
} from '../utils/reminder.js';

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
  } catch {
    // Notification deduplication becomes session-only if storage is unavailable.
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

export function useDueRecordReminders({ schedules, dateKey, preferences }) {
  const [now, setNow] = useState(() => new Date());

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

  const dueSchedules = useMemo(
    () => getDuePendingSchedules(schedules, dateKey, now, preferences),
    [dateKey, now, preferences, schedules],
  );

  useEffect(() => {
    if (!preferences.browserNotifications || dueSchedules.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const todayKey = dateKeyFromDate(now);
    const notified = new Set(readNotifiedKeys(todayKey));
    const pendingNotifications = dueSchedules.filter((schedule) => !notified.has(reminderNotificationKey(dateKey, schedule.id)));
    if (pendingNotifications.length === 0) return;

    let cancelled = false;
    const notify = async () => {
      for (const schedule of pendingNotifications) {
        if (cancelled) return;
        const shown = await showBrowserNotification(schedule, dateKey);
        if (!shown || cancelled) continue;
        const key = reminderNotificationKey(dateKey, schedule.id);
        notified.add(key);
        writeNotifiedKeys([...notified]);
      }
    };
    notify();
    return () => { cancelled = true; };
  }, [dateKey, dueSchedules, now, preferences.browserNotifications]);

  return dueSchedules;
}
