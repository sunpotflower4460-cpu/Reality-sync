import { useCallback, useEffect, useState } from 'react';
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
        setState((current) => ({ ...current, persistenceBlocked: true, needsWrite: false }));
        return;
      }
      const latestSerialized = serializePreferences(latest.preferences);
      if (latestSerialized !== baseSerialized) {
        setState((current) => ({
          ...current,
          writeConflict: true,
          writeFailed: false,
          needsWrite: false,
        }));
        return;
      }

      const writtenSerialized = serializePreferences(preferences);
      window.localStorage.setItem(REMINDER_STORAGE_KEY, writtenSerialized);
      setState((current) => {
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
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [baseSerialized, needsWrite, persistenceBlocked, preferences, writeConflict]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event.key !== REMINDER_STORAGE_KEY) return;
      const result = parseStoredReminderPreferencesResult(event.newValue);
      setState((current) => {
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
  }, []);

  const setPreferences = useCallback((nextValue) => {
    setState((current) => {
      if (current.persistenceBlocked || current.writeConflict) return current;
      const next = typeof nextValue === 'function' ? nextValue(current.preferences) : nextValue;
      const validated = validateReminderPreferences(next);
      if (!validated) return current;
      return { ...current, preferences: validated, needsWrite: true };
    });
  }, []);

  const replacePreferences = useCallback((nextValue) => {
    const validated = validateReminderPreferences(nextValue);
    if (!validated) return;
    setState({
      preferences: validated,
      persistenceBlocked: false,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializePreferences(validated),
      writeConflict: false,
    });
  }, []);

  return {
    preferences,
    setPreferences,
    replacePreferences,
    storageProtection: { persistenceBlocked, writeFailed, writeConflict },
  };
}
