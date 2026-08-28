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

function loadReminderState() {
  if (typeof window === 'undefined') {
    return { preferences: normalizeReminderPreferences(null), persistenceBlocked: false, writeFailed: false, needsWrite: false };
  }
  try {
    const result = parseStoredReminderPreferencesResult(window.localStorage.getItem(REMINDER_STORAGE_KEY));
    return { preferences: result.preferences, persistenceBlocked: !result.ok, writeFailed: false, needsWrite: false };
  } catch {
    return { preferences: normalizeReminderPreferences(null), persistenceBlocked: true, writeFailed: false, needsWrite: false };
  }
}

export function useReminderPreferences() {
  const [state, setState] = useState(loadReminderState);
  const { preferences, persistenceBlocked, writeFailed, needsWrite } = state;

  useEffect(() => {
    if (persistenceBlocked || !needsWrite) return;
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(preferences));
      setState((current) => ({ ...current, writeFailed: false, needsWrite: false }));
    } catch {
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [needsWrite, persistenceBlocked, preferences]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event.key !== REMINDER_STORAGE_KEY) return;
      const result = parseStoredReminderPreferencesResult(event.newValue);
      setState({ preferences: result.preferences, persistenceBlocked: !result.ok, writeFailed: false, needsWrite: false });
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, []);

  const setPreferences = useCallback((nextValue) => {
    setState((current) => {
      if (current.persistenceBlocked) return current;
      const next = typeof nextValue === 'function' ? nextValue(current.preferences) : nextValue;
      const validated = validateReminderPreferences(next);
      if (!validated) return current;
      return { ...current, preferences: validated, needsWrite: true };
    });
  }, []);

  const replacePreferences = useCallback((nextValue) => {
    const validated = validateReminderPreferences(nextValue);
    if (!validated) return;
    setState({ preferences: validated, persistenceBlocked: false, writeFailed: false, needsWrite: false });
  }, []);

  return {
    preferences,
    setPreferences,
    replacePreferences,
    storageProtection: { persistenceBlocked, writeFailed },
  };
}
