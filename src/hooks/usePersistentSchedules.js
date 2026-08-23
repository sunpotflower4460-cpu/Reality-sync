import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import { normalizeSchedules } from '../utils/schedule.js';
import {
  createEmptyScheduleStore,
  migrateLegacySchedules,
  normalizeScheduleStore,
  parseStoredScheduleStoreResult,
} from '../utils/storage.js';

function loadScheduleState() {
  if (typeof window === 'undefined') {
    return { store: createEmptyScheduleStore(), persistenceBlocked: false, unsupportedVersion: null };
  }

  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      const result = parseStoredScheduleStoreResult(current);
      return {
        store: result.store,
        persistenceBlocked: !result.ok,
        unsupportedVersion: result.unsupportedVersion,
      };
    }

    return {
      store: migrateLegacySchedules(
        window.localStorage.getItem(LEGACY_STORAGE_KEY),
        dateKeyFromDate(),
        INITIAL_SCHEDULES,
      ),
      persistenceBlocked: false,
      unsupportedVersion: null,
    };
  } catch {
    return { store: createEmptyScheduleStore(), persistenceBlocked: false, unsupportedVersion: null };
  }
}

export function usePersistentSchedules(dateKey) {
  const [state, setState] = useState(loadScheduleState);
  const { store, persistenceBlocked, unsupportedVersion } = state;
  const schedules = useMemo(() => store.days[dateKey] ?? [], [dateKey, store.days]);

  useEffect(() => {
    if (persistenceBlocked) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Restricted/private browsing can reject storage. In-memory mode remains usable.
    }
  }, [persistenceBlocked, store]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const result = parseStoredScheduleStoreResult(event.newValue);
      setState({
        store: result.store,
        persistenceBlocked: !result.ok,
        unsupportedVersion: result.unsupportedVersion,
      });
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const setSchedules = useCallback((nextValue) => {
    setState((currentState) => {
      const currentDay = currentState.store.days[dateKey] ?? [];
      const nextDay = typeof nextValue === 'function' ? nextValue(currentDay) : nextValue;
      return {
        ...currentState,
        store: {
          ...currentState.store,
          days: {
            ...currentState.store.days,
            [dateKey]: normalizeSchedules(nextDay, []),
          },
        },
      };
    });
  }, [dateKey]);

  const clearDay = useCallback(() => {
    setState((currentState) => {
      if (!(dateKey in currentState.store.days)) return currentState;
      const days = { ...currentState.store.days };
      delete days[dateKey];
      return { ...currentState, store: { ...currentState.store, days } };
    });
  }, [dateKey]);

  const replaceStore = useCallback((nextStore) => {
    setState({
      store: normalizeScheduleStore(nextStore),
      persistenceBlocked: false,
      unsupportedVersion: null,
    });
  }, []);

  return {
    schedules,
    setSchedules,
    clearDay,
    store,
    replaceStore,
    storageProtection: { persistenceBlocked, unsupportedVersion },
  };
}
