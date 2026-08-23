import { normalizeSchedules } from './schedule.js';

export function parseStoredSchedules(raw, fallbacks = []) {
  if (!raw) return normalizeSchedules(fallbacks, fallbacks);

  try {
    return normalizeSchedules(JSON.parse(raw), fallbacks);
  } catch {
    return normalizeSchedules(fallbacks, fallbacks);
  }
}
