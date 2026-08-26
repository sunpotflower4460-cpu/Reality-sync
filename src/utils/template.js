import { CATEGORIES } from '../constants.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

function templateScheduleInputValid(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const duration = Number(value.duration);
  const plannedStress = Number(value.plannedStress);
  return Boolean(
    isValidTime(value.time)
    && title
    && CATEGORIES.includes(value.category)
    && Number.isFinite(duration)
    && duration >= 0
    && duration <= 1440
    && Number.isFinite(plannedStress)
    && plannedStress >= 0
    && plannedStress <= 100
  );
}

function normalizeTemplateItem(value) {
  if (!templateScheduleInputValid(value)) return null;
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

export function parseStoredTemplatesResult(raw) {
  if (!raw) return { ok: true, templates: [] };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, templates: [] }; }
  if (!Array.isArray(parsed)) return { ok: false, templates: [] };
  const templates = normalizeTemplates(parsed);
  if (templates.length !== parsed.length) return { ok: false, templates: [] };
  for (let index = 0; index < parsed.length; index += 1) {
    const rawTemplate = parsed[index];
    const normalized = templates[index];
    if (!Array.isArray(rawTemplate?.schedules) || rawTemplate.schedules.length !== normalized.schedules.length) {
      return { ok: false, templates: [] };
    }
  }
  return { ok: true, templates };
}

export function parseStoredTemplates(raw) {
  return parseStoredTemplatesResult(raw).templates;
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
