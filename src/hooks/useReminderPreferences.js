import { useCallback, useEffect, useState } from 'react';
import { REMINDER_STORAGE_KEY } from '../constants.js';
import {
  normalizeReminderPreferences,
  parseStoredReminderPreferencesResult,
} from '../utils/reminder.js';

function loadReminderState() {
  if (typeof window === 'undefined') {
    return { preferences: normalizeReminderPreferences(null), persistenceBlocked: false };
  }
  try {
    const result = parseStoredReminderPreferencesResult(window.localStorage.getItem(REMINDER_STORAGE_KEY));
    return { preferences: result.preferences, persistenceBlocked: !result.ok };
  } catch {
    return { preferences: normalizeReminderPreferences(null), persistenceBlocked: false };
  }
}

export function useReminderPreferences() {
  const [state, setState] = useState(loadReminderState);
  const { preferences, persistenceBlocked } = state;

  useEffect(() => {
    if (persistenceBlocked) return;
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // In-memory settings remain usable when storage is unavailable.
    }
  }, [persistenceBlocked, preferences]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event.key !== REMINDER_STORAGE_KEY) return;
      const result = parseStoredReminderPreferencesResult(event.newValue);
      setState({ preferences: result.preferences, persistenceBlocked: !result.ok });
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, []);

  const setPreferences = useCallback((nextValue) => {
    setState((current) => {
      if (current.persistenceBlocked) return current;
      const next = typeof nextValue === 'function' ? nextValue(current.preferences) : nextValue;
      return { ...current, preferences: normalizeReminderPreferences(next) };
    });
  }, []);

  const replacePreferences = useCallback((nextValue) => {
    setState({ preferences: normalizeReminderPreferences(nextValue), persistenceBlocked: false });
  }, []);

  return {
    preferences,
    setPreferences,
    replacePreferences,
    storageProtection: { persistenceBlocked },
  };
}
