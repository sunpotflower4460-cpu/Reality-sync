import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const applyState = useCallback((updater) => {
    const current = stateRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    stateRef.current = next;
    setState(next);
    return next;
  }, []);
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
    let persistedStore = store;
    try {
      if (dirtyDateKeys.length > 0) {
        const latest = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY));
        if (!latest.ok) {
          applyState((current) => ({
            ...current,
            persistenceBlocked: true,
            unsupportedVersion: latest.unsupportedVersion,
            needsWrite: false,
          }));
          return;
        }

        const merged = mergeScheduleStoreWrite(latest.store, store, dirtyDateKeys, baseDays);
        if (!merged.ok) {
          applyState((current) => ({
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
    } catch {
      applyState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
      return;
    }

    // The primary versioned store is already durable at this point. Commit the
    // successful write before attempting to remove an obsolete legacy key, so a
    // cleanup-only failure cannot make the next retry conflict with our own data.
    applyState((current) => {
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

    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Legacy data is ignored whenever the versioned store exists. Failure to
      // remove this obsolete copy must not turn a successful primary save into a
      // write failure or trigger a self-conflict on retry.
    }
  }, [applyState, baseDays, dirtyDateKeys, needsWrite, persistenceBlocked, store, writeConflict]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const result = parseStoredScheduleStoreResult(event.newValue);
      applyState((current) => {
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
  }, [applyState]);

  const latestStateBeforeMutation = useCallback(() => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return null;
    // The only whole-store write with no dirty dates is the known legacy
    // migration. Preserve that in-memory migration until its write effect runs.
    if (current.needsWrite && current.dirtyDateKeys.length === 0) return current;
    try {
      const latest = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY));
      if (!latest.ok) {
        applyState({
          ...current,
          persistenceBlocked: true,
          unsupportedVersion: latest.unsupportedVersion,
          needsWrite: false,
        });
        return null;
      }
      const merged = mergeScheduleStoreWrite(
        latest.store,
        current.store,
        current.dirtyDateKeys,
        current.baseDays,
      );
      if (!merged.ok) {
        applyState({
          ...current,
          writeConflict: true,
          conflictDateKeys: merged.conflictDateKeys,
          writeFailed: false,
          needsWrite: false,
        });
        return null;
      }
      return { ...current, store: merged.store, writeFailed: false };
    } catch {
      applyState({ ...current, persistenceBlocked: true, needsWrite: false });
      return null;
    }
  }, [applyState]);

  // Apply UI mutations synchronously against both the latest hook state and the
  // latest readable device store. This catches a remote write even if its
  // storage event has not been delivered to React yet. Store-aware updaters may
  // also inspect other dates from this exact same preflight snapshot so source
  // data for copy/replace flows cannot come from an older render.
  const setSchedules = useCallback((nextValue) => {
    const currentState = latestStateBeforeMutation();
    if (!currentState) return false;
    const currentDay = currentState.store.days[dateKey] ?? [];
    const nextDay = typeof nextValue === 'function'
      ? nextValue(currentDay, currentState.store)
      : nextValue;
    if (!Array.isArray(nextDay)) {
      if (currentState !== stateRef.current) applyState(currentState);
      return false;
    }
    const result = parseStoredScheduleStoreResult(JSON.stringify({
      version: STORAGE_VERSION,
      days: { [dateKey]: nextDay },
    }));
    if (!result.ok) return false;
    const alreadyDirty = currentState.dirtyDateKeys.includes(dateKey);
    const nextState = {
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
    applyState(nextState);
    return true;
  }, [applyState, dateKey, latestStateBeforeMutation]);

  const clearDay = useCallback(() => {
    const currentState = latestStateBeforeMutation();
    if (!currentState || !(dateKey in currentState.store.days)) return false;
    const currentDay = currentState.store.days[dateKey] ?? [];
    const days = { ...currentState.store.days };
    delete days[dateKey];
    const alreadyDirty = currentState.dirtyDateKeys.includes(dateKey);
    const nextState = {
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
    applyState(nextState);
    return true;
  }, [applyState, dateKey, latestStateBeforeMutation]);

  const replaceStore = useCallback((nextStore) => {
    const result = parseStoredScheduleStoreResult(JSON.stringify(nextStore));
    if (!result.ok) return false;
    applyState({
      store: result.store,
      persistenceBlocked: false,
      unsupportedVersion: null,
      writeFailed: false,
      // Restore and erase callers persist/remove storage explicitly before this
      // state replacement, so do not echo a stale whole-store write on mount.
      needsWrite: false,
      ...initialWriteTracking(),
    });
    return true;
  }, [applyState]);

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
