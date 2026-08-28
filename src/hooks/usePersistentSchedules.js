import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, STORAGE_VERSION } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import {
  createEmptyScheduleStore,
  migrateLegacySchedulesResult,
  parseStoredScheduleStoreResult,
} from '../utils/storage.js';

function loadScheduleState() {
  if (typeof window === 'undefined') {
    return { store: createEmptyScheduleStore(), persistenceBlocked: false, unsupportedVersion: null, writeFailed: false, needsWrite: false };
  }

  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      const result = parseStoredScheduleStoreResult(current);
      return {
        store: result.store,
        persistenceBlocked: !result.ok,
        unsupportedVersion: result.unsupportedVersion,
        writeFailed: false,
        needsWrite: false,
      };
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const migration = migrateLegacySchedulesResult(
      legacyRaw,
      dateKeyFromDate(),
      INITIAL_SCHEDULES,
    );
    return {
      store: migration.store,
      persistenceBlocked: !migration.ok,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: Boolean(legacyRaw) && migration.ok,
    };
  } catch {
    // A failed read is not evidence that storage is empty. Blocking persistence
    // prevents a later successful write from replacing unseen on-device data.
    return { store: createEmptyScheduleStore(), persistenceBlocked: true, unsupportedVersion: null, writeFailed: false, needsWrite: false };
  }
}

export function usePersistentSchedules(dateKey) {
  const [state, setState] = useState(loadScheduleState);
  const { store, persistenceBlocked, unsupportedVersion, writeFailed, needsWrite } = state;
  const schedules = useMemo(() => store.days[dateKey] ?? [], [dateKey, store.days]);

  useEffect(() => {
    if (persistenceBlocked || !needsWrite) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setState((current) => ({ ...current, writeFailed: false, needsWrite: false }));
    } catch {
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [needsWrite, persistenceBlocked, store]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const result = parseStoredScheduleStoreResult(event.newValue);
      setState({
        store: result.store,
        persistenceBlocked: !result.ok,
        unsupportedVersion: result.unsupportedVersion,
        writeFailed: false,
        needsWrite: false,
      });
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const setSchedules = useCallback((nextValue) => {
    setState((currentState) => {
      if (currentState.persistenceBlocked) return currentState;
      const currentDay = currentState.store.days[dateKey] ?? [];
      const nextDay = typeof nextValue === 'function' ? nextValue(currentDay) : nextValue;
      if (!Array.isArray(nextDay)) return currentState;
      const result = parseStoredScheduleStoreResult(JSON.stringify({
        version: STORAGE_VERSION,
        days: { [dateKey]: nextDay },
      }));
      if (!result.ok) return currentState;
      return {
        ...currentState,
        needsWrite: true,
        store: {
          ...currentState.store,
          days: {
            ...currentState.store.days,
            [dateKey]: result.store.days[dateKey] ?? [],
          },
        },
      };
    });
  }, [dateKey]);

  const clearDay = useCallback(() => {
    setState((currentState) => {
      if (currentState.persistenceBlocked || !(dateKey in currentState.store.days)) return currentState;
      const days = { ...currentState.store.days };
      delete days[dateKey];
      return { ...currentState, needsWrite: true, store: { ...currentState.store, days } };
    });
  }, [dateKey]);

  const replaceStore = useCallback((nextStore) => {
    const result = parseStoredScheduleStoreResult(JSON.stringify(nextStore));
    if (!result.ok) return;
    setState({
      store: result.store,
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      // Restore and erase callers persist/remove storage explicitly before this
      // state replacement, so do not echo a stale whole-store write on mount.
      needsWrite: false,
    });
  }, []);

  return {
    schedules,
    setSchedules,
    clearDay,
    store,
    replaceStore,
    storageProtection: { persistenceBlocked, unsupportedVersion, writeFailed },
  };
}
