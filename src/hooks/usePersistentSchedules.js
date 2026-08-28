import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, STORAGE_VERSION } from '../constants.js';
import { dateKeyFromDate } from '../utils/date.js';
import {
  createEmptyScheduleStore,
  mergeScheduleStoreWrite,
  migrateLegacySchedulesResult,
  parseStoredScheduleStoreResult,
} from '../utils/storage.js';

function initialWriteTracking() {
  return { dirtyDateKeys: [], baseDays: {}, writeConflict: false, conflictDateKeys: [] };
}

function loadScheduleState() {
  if (typeof window === 'undefined') {
    return {
      store: createEmptyScheduleStore(),
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      ...initialWriteTracking(),
    };
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
        ...initialWriteTracking(),
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
      ...initialWriteTracking(),
    };
  } catch {
    // A failed read is not evidence that storage is empty. Blocking persistence
    // prevents a later successful write from replacing unseen on-device data.
    return {
      store: createEmptyScheduleStore(),
      persistenceBlocked: true,
      unsupportedVersion: null,
      writeFailed: false,
      needsWrite: false,
      ...initialWriteTracking(),
    };
  }
}

function overlayDirtyDays(baseStore, localStore, dirtyDateKeys) {
  const days = { ...baseStore.days };
  for (const dirtyDateKey of dirtyDateKeys) {
    if (Object.prototype.hasOwnProperty.call(localStore.days, dirtyDateKey)) {
      days[dirtyDateKey] = localStore.days[dirtyDateKey];
    } else {
      delete days[dirtyDateKey];
    }
  }
  return { version: STORAGE_VERSION, days };
}

export function usePersistentSchedules(dateKey) {
  const [state, setState] = useState(loadScheduleState);
  const {
    store,
    persistenceBlocked,
    unsupportedVersion,
    writeFailed,
    needsWrite,
    dirtyDateKeys,
    baseDays,
    writeConflict,
    conflictDateKeys,
  } = state;
  const schedules = useMemo(() => store.days[dateKey] ?? [], [dateKey, store.days]);

  useEffect(() => {
    if (persistenceBlocked || writeConflict || !needsWrite) return;
    try {
      let persistedStore = store;
      if (dirtyDateKeys.length > 0) {
        const latest = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY));
        if (!latest.ok) {
          setState((current) => ({
            ...current,
            persistenceBlocked: true,
            unsupportedVersion: latest.unsupportedVersion,
            needsWrite: false,
          }));
          return;
        }

        const merged = mergeScheduleStoreWrite(latest.store, store, dirtyDateKeys, baseDays);
        if (!merged.ok) {
          setState((current) => ({
            ...current,
            writeConflict: true,
            conflictDateKeys: merged.conflictDateKeys,
            writeFailed: false,
            needsWrite: false,
          }));
          return;
        }
        persistedStore = merged.store;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedStore));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);

      setState((current) => {
        const written = new Set(dirtyDateKeys);
        const remainingDirty = current.dirtyDateKeys.filter((key) => !written.has(key));
        const remainingBaseDays = Object.fromEntries(
          remainingDirty.map((key) => [key, current.baseDays[key] ?? []]),
        );
        return {
          ...current,
          store: remainingDirty.length > 0
            ? overlayDirtyDays(persistedStore, current.store, remainingDirty)
            : persistedStore,
          writeFailed: false,
          needsWrite: remainingDirty.length > 0,
          dirtyDateKeys: remainingDirty,
          baseDays: remainingBaseDays,
        };
      });
    } catch {
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [baseDays, dirtyDateKeys, needsWrite, persistenceBlocked, store, writeConflict]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const result = parseStoredScheduleStoreResult(event.newValue);
      setState((current) => {
        if (!result.ok) {
          return {
            ...current,
            persistenceBlocked: true,
            unsupportedVersion: result.unsupportedVersion,
            writeFailed: false,
            needsWrite: false,
          };
        }

        // Once a conflict is detected, keep the local in-memory copy frozen for
        // rescue/export. Later storage events must not silently replace it.
        if (current.writeConflict) return current;

        if (!current.needsWrite || current.dirtyDateKeys.length === 0) {
          return {
            store: result.store,
            persistenceBlocked: false,
            unsupportedVersion: null,
            writeFailed: false,
            needsWrite: false,
            ...initialWriteTracking(),
          };
        }

        const merged = mergeScheduleStoreWrite(
          result.store,
          current.store,
          current.dirtyDateKeys,
          current.baseDays,
        );
        if (!merged.ok) {
          return {
            ...current,
            writeConflict: true,
            conflictDateKeys: merged.conflictDateKeys,
            writeFailed: false,
            needsWrite: false,
          };
        }
        return { ...current, store: merged.store, writeFailed: false };
      });
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const setSchedules = useCallback((nextValue) => {
    setState((currentState) => {
      if (currentState.persistenceBlocked || currentState.writeConflict) return currentState;
      const currentDay = currentState.store.days[dateKey] ?? [];
      const nextDay = typeof nextValue === 'function' ? nextValue(currentDay) : nextValue;
      if (!Array.isArray(nextDay)) return currentState;
      const result = parseStoredScheduleStoreResult(JSON.stringify({
        version: STORAGE_VERSION,
        days: { [dateKey]: nextDay },
      }));
      if (!result.ok) return currentState;
      const alreadyDirty = currentState.dirtyDateKeys.includes(dateKey);
      return {
        ...currentState,
        needsWrite: true,
        dirtyDateKeys: alreadyDirty
          ? currentState.dirtyDateKeys
          : [...currentState.dirtyDateKeys, dateKey],
        baseDays: alreadyDirty
          ? currentState.baseDays
          : { ...currentState.baseDays, [dateKey]: currentDay },
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
      if (
        currentState.persistenceBlocked
        || currentState.writeConflict
        || !(dateKey in currentState.store.days)
      ) return currentState;
      const currentDay = currentState.store.days[dateKey] ?? [];
      const days = { ...currentState.store.days };
      delete days[dateKey];
      const alreadyDirty = currentState.dirtyDateKeys.includes(dateKey);
      return {
        ...currentState,
        needsWrite: true,
        dirtyDateKeys: alreadyDirty
          ? currentState.dirtyDateKeys
          : [...currentState.dirtyDateKeys, dateKey],
        baseDays: alreadyDirty
          ? currentState.baseDays
          : { ...currentState.baseDays, [dateKey]: currentDay },
        store: { ...currentState.store, days },
      };
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
      ...initialWriteTracking(),
    });
  }, []);

  return {
    schedules,
    setSchedules,
    clearDay,
    store,
    replaceStore,
    storageProtection: {
      persistenceBlocked,
      unsupportedVersion,
      writeFailed,
      writeConflict,
      conflictDateKeys,
    },
  };
}
