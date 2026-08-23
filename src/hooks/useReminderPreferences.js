import { useCallback, useEffect, useState } from 'react';
import { REMINDER_STORAGE_KEY } from '../constants.js';
import { normalizeReminderPreferences, parseStoredReminderPreferences } from '../utils/reminder.js';

function loadReminderPreferences() {
  if (typeof window === 'undefined') return normalizeReminderPreferences(null);
  try {
    return parseStoredReminderPreferences(window.localStorage.getItem(REMINDER_STORAGE_KEY));
  } catch {
    return normalizeReminderPreferences(null);
  }
}

export function useReminderPreferences() {
  const [preferences, setPreferencesState] = useState(loadReminderPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // In-memory settings remain usable when storage is unavailable.
    }
  }, [preferences]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event.key !== REMINDER_STORAGE_KEY) return;
      setPreferencesState(parseStoredReminderPreferences(event.newValue));
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, []);

  const setPreferences = useCallback((nextValue) => {
    setPreferencesState((current) => normalizeReminderPreferences(
      typeof nextValue === 'function' ? nextValue(current) : nextValue,
    ));
  }, []);

  const replacePreferences = useCallback((nextValue) => {
    setPreferencesState(normalizeReminderPreferences(nextValue));
  }, []);

  return { preferences, setPreferences, replacePreferences };
}
