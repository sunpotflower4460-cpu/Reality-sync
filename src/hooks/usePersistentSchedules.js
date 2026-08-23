import { useEffect, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { STORAGE_KEY } from '../constants.js';
import { parseStoredSchedules } from '../utils/storage.js';

function cloneDemoSchedules() {
  return parseStoredSchedules(null, INITIAL_SCHEDULES);
}

function loadSchedules() {
  if (typeof window === 'undefined') return cloneDemoSchedules();

  try {
    return parseStoredSchedules(window.localStorage.getItem(STORAGE_KEY), INITIAL_SCHEDULES);
  } catch {
    return cloneDemoSchedules();
  }
}

export function usePersistentSchedules() {
  const [schedules, setSchedules] = useState(loadSchedules);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    } catch {
      // Restricted/private browsing can reject storage. In-memory mode remains usable.
    }
  }, [schedules]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setSchedules(parseStoredSchedules(event.newValue, INITIAL_SCHEDULES));
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const resetSchedules = () => setSchedules(cloneDemoSchedules());

  return { schedules, setSchedules, resetSchedules };
}
