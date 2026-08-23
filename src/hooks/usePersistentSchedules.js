import { useEffect, useState } from 'react';
import { INITIAL_SCHEDULES } from '../data/demoSchedules.js';
import { STORAGE_KEY } from '../constants.js';

function cloneDemoSchedules() {
  return INITIAL_SCHEDULES.map((item) => ({ ...item }));
}

function loadSchedules() {
  if (typeof window === 'undefined') return cloneDemoSchedules();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDemoSchedules();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : cloneDemoSchedules();
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

  const resetSchedules = () => setSchedules(cloneDemoSchedules());

  return { schedules, setSchedules, resetSchedules };
}
