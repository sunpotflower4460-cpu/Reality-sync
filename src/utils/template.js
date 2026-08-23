import { normalizeSchedules } from './schedule.js';

function normalizeTemplateItem(value) {
  const [schedule] = normalizeSchedules([value], []);
  if (!schedule) return null;
  return {
    time: schedule.time,
    title: schedule.title,
    category: schedule.category,
    duration: schedule.duration,
    plannedStress: schedule.plannedStress,
    appliedExperimentIds: [...schedule.appliedExperimentIds],
  };
}

export function normalizeTemplates(value) {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();
  const templates = [];

  value.forEach((template, index) => {
    if (!template || typeof template !== 'object' || Array.isArray(template)) return;
    const id = typeof template.id === 'string' && template.id.trim()
      ? template.id.trim()
      : `template-${index + 1}`;
    if (seenIds.has(id)) return;
    const name = typeof template.name === 'string' ? template.name.trim() : '';
    if (!name) return;
    const schedules = Array.isArray(template.schedules)
      ? template.schedules.map(normalizeTemplateItem).filter(Boolean)
      : [];
    if (schedules.length === 0) return;
    seenIds.add(id);
    templates.push({ id, name, schedules });
  });

  return templates;
}

export function parseStoredTemplates(raw) {
  if (!raw) return [];
  try {
    return normalizeTemplates(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function createTemplateFromSchedules(name, schedules, id) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || !id) return null;
  const planItems = normalizeSchedules(schedules, []).map((schedule) => ({
    time: schedule.time,
    title: schedule.title,
    category: schedule.category,
    duration: schedule.duration,
    plannedStress: schedule.plannedStress,
    appliedExperimentIds: [...schedule.appliedExperimentIds],
  }));
  if (planItems.length === 0) return null;
  return { id, name: normalizedName, schedules: planItems };
}
