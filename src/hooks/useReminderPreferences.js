import { useCallback, useEffect, useRef, useState } from 'react';
import { REMINDER_STORAGE_KEY } from '../constants.js';
import {
  normalizeReminderPreferences,
  parseStoredReminderPreferencesResult,
} from '../utils/reminder.js';

function validateReminderPreferences(nextValue) {
  const result = parseStoredReminderPreferencesResult(JSON.stringify(nextValue));
  return result.ok ? result.preferences : null;
}

function serializePreferences(preferences) {
  return JSON.stringify(preferences);
}

function loadReminderState() {
  if (typeof window === 'undefined') {
    const preferences = normalizeReminderPreferences(null);
    return {
      preferences,
      persistenceBlocked: false,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializePreferences(preferences),
      writeConflict: false,
    };
  }
  try {
    const result = parseStoredReminderPreferencesResult(window.localStorage.getItem(REMINDER_STORAGE_KEY));
    return {
      preferences: result.preferences,
      persistenceBlocked: !result.ok,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializePreferences(result.preferences),
      writeConflict: false,
    };
  } catch {
    const preferences = normalizeReminderPreferences(null);
    return {
      preferences,
      persistenceBlocked: true,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializePreferences(preferences),
      writeConflict: false,
    };
  }
}

export function useReminderPreferences() {
  const [state, setState] = useState(loadReminderState);
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
    preferences,
    persistenceBlocked,
    writeFailed,
    needsWrite,
    baseSerialized,
    writeConflict,
  } = state;

  useEffect(() => {
    if (persistenceBlocked || writeConflict || !needsWrite) return;
    try {
      const latest = parseStoredReminderPreferencesResult(
        window.localStorage.getItem(REMINDER_STORAGE_KEY),
      );
      if (!latest.ok) {
        applyState((current) => ({ ...current, persistenceBlocked: true, needsWrite: false }));
        return;
      }
      const latestSerialized = serializePreferences(latest.preferences);
      if (latestSerialized !== baseSerialized) {
        applyState((current) => ({
          ...current,
          writeConflict: true,
          writeFailed: false,
          needsWrite: false,
        }));
        return;
      }

      const writtenSerialized = serializePreferences(preferences);
      window.localStorage.setItem(REMINDER_STORAGE_KEY, writtenSerialized);
      applyState((current) => {
        const currentSerialized = serializePreferences(current.preferences);
        const changedAgain = currentSerialized !== writtenSerialized;
        return {
          ...current,
          writeFailed: false,
          needsWrite: changedAgain,
          baseSerialized: writtenSerialized,
        };
      });
    } catch {
      applyState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [applyState, baseSerialized, needsWrite, persistenceBlocked, preferences, writeConflict]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event.key !== REMINDER_STORAGE_KEY) return;
      const result = parseStoredReminderPreferencesResult(event.newValue);
      applyState((current) => {
        if (!result.ok) {
          return { ...current, persistenceBlocked: true, writeFailed: false, needsWrite: false };
        }
        const externalSerialized = serializePreferences(result.preferences);
        if (current.needsWrite) {
          if (externalSerialized !== current.baseSerialized) {
            return { ...current, writeConflict: true, writeFailed: false, needsWrite: false };
          }
          return current;
        }
        if (current.writeConflict) return current;
        return {
          preferences: result.preferences,
          persistenceBlocked: false,
          writeFailed: false,
          needsWrite: false,
          baseSerialized: externalSerialized,
          writeConflict: false,
        };
      });
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, [applyState]);

  const latestStateBeforeMutation = useCallback(() => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return null;
    try {
      const latest = parseStoredReminderPreferencesResult(
        window.localStorage.getItem(REMINDER_STORAGE_KEY),
      );
      if (!latest.ok) {
        applyState({ ...current, persistenceBlocked: true, needsWrite: false });
        return null;
      }
      const latestSerialized = serializePreferences(latest.preferences);
      if (latestSerialized === current.baseSerialized) return current;
      if (current.needsWrite) {
        applyState({ ...current, writeConflict: true, writeFailed: false, needsWrite: false });
        return null;
      }
      return {
        preferences: latest.preferences,
        persistenceBlocked: false,
        writeFailed: false,
        needsWrite: false,
        baseSerialized: latestSerialized,
        writeConflict: false,
      };
    } catch {
      applyState({ ...current, persistenceBlocked: true, needsWrite: false });
      return null;
    }
  }, [applyState]);

  const setPreferences = useCallback((nextValue) => {
    const current = latestStateBeforeMutation();
    if (!current) return false;
    const next = typeof nextValue === 'function' ? nextValue(current.preferences) : nextValue;
    const validated = validateReminderPreferences(next);
    if (!validated) {
      if (current !== stateRef.current) applyState(current);
      return false;
    }
    applyState({ ...current, preferences: validated, needsWrite: true });
    return true;
  }, [applyState, latestStateBeforeMutation]);

  const replacePreferences = useCallback((nextValue) => {
    const validated = validateReminderPreferences(nextValue);
    if (!validated) return false;
    applyState({
      preferences: validated,
      persistenceBlocked: false,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializePreferences(validated),
      writeConflict: false,
    });
    return true;
  }, [applyState]);

  return {
    preferences,
    setPreferences,
    replacePreferences,
    storageProtection: { persistenceBlocked, writeFailed, writeConflict },
  };
}
