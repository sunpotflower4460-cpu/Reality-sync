import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import { normalizeSchedules } from '../utils/schedule.js';
import {
  createEmptyScheduleStore,
  migrateLegacySchedules,
  normalizeScheduleStore,
  parseStoredScheduleStore,
} from '../utils/storage.js';

function loadScheduleStore() {
  if (typeof window === 'undefined') return createEmptyScheduleStore();

  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return parseStoredScheduleStore(current);

    return migrateLegacySchedules(
      window.localStorage.getItem(LEGACY_STORAGE_KEY),
      dateKeyFromDate(),
      INITIAL_SCHEDULES,
    );
  } catch {
    return createEmptyScheduleStore();
  }
}

export function usePersistentSchedules(dateKey) {
  const [store, setStore] = useState(loadScheduleStore);
  const schedules = useMemo(() => store.days[dateKey] ?? [], [dateKey, store.days]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Restricted/private browsing can reject storage. In-memory mode remains usable.
    }
  }, [store]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setStore(parseStoredScheduleStore(event.newValue));
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const setSchedules = useCallback((nextValue) => {
    setStore((current) => {
      const currentDay = current.days[dateKey] ?? [];
      const nextDay = typeof nextValue === 'function' ? nextValue(currentDay) : nextValue;
      return {
        ...current,
        days: {
          ...current.days,
          [dateKey]: normalizeSchedules(nextDay, []),
        },
      };
    });
  }, [dateKey]);

  const clearDay = useCallback(() => {
    setStore((current) => {
      if (!(dateKey in current.days)) return current;
      const days = { ...current.days };
      delete days[dateKey];
      return { ...current, days };
    });
  }, [dateKey]);

  const replaceStore = useCallback((nextStore) => {
    setStore(normalizeScheduleStore(nextStore));
  }, []);

  return { schedules, setSchedules, clearDay, store, replaceStore };
}
