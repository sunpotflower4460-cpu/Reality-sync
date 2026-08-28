import { CATEGORIES } from '../constants.js';
import { isValidTime, normalizeSchedules } from './schedule.js';

const TEMPLATE_FIELDS = new Set(['id', 'name', 'schedules']);
const TEMPLATE_SCHEDULE_FIELDS = new Set([
  'time',
  'title',
  'category',
  'duration',
  'plannedStress',
  'appliedExperimentIds',
]);

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function appliedExperimentIdsInputValid(value) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 50) return false;
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') return false;
    const id = item.trim();
    if (!id || item !== id || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function templateScheduleInputValid(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const duration = finiteNumber(value.duration);
  const plannedStress = finiteNumber(value.plannedStress);
  return Boolean(
    isValidTime(value.time)
    && title
    && CATEGORIES.includes(value.category)
    && duration !== null
    && duration >= 0
    && duration <= 1440
    && plannedStress !== null
    && plannedStress >= 0
    && plannedStress <= 100
    && appliedExperimentIdsInputValid(value.appliedExperimentIds)
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

function storedTemplateSchedulePreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;
  if (Object.keys(raw).some((key) => !TEMPLATE_SCHEDULE_FIELDS.has(key))) return false;
  if (!templateScheduleInputValid(raw)) return false;
  // Stored template facts are versioned app data, not a loose form payload.
  // Reject type-changing coercion such as "60" -> 60 so future writes cannot
  // silently rewrite a fact that was not stored in the current schema type.
  if (typeof raw.duration !== 'number' || typeof raw.plannedStress !== 'number') return false;

  const duration = finiteNumber(raw.duration);
  const plannedStress = finiteNumber(raw.plannedStress);
  if (normalized.time !== raw.time) return false;
  if (normalized.title !== raw.title.trim()) return false;
  if (normalized.category !== raw.category) return false;
  if (normalized.duration !== duration) return false;
  if (normalized.plannedStress !== plannedStress) return false;

  if (raw.appliedExperimentIds === undefined) return normalized.appliedExperimentIds.length === 0;
  return raw.appliedExperimentIds.length === normalized.appliedExperimentIds.length
    && raw.appliedExperimentIds.every((id, index) => id === normalized.appliedExperimentIds[index]);
}

function storedTemplatePreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !normalized) return false;
  if (Object.keys(raw).some((key) => !TEMPLATE_FIELDS.has(key))) return false;
  if (typeof raw.id !== 'string' || !raw.id.trim() || normalized.id !== raw.id.trim()) return false;
  if (typeof raw.name !== 'string' || !raw.name.trim() || normalized.name !== raw.name.trim()) return false;
  if (!Array.isArray(raw.schedules) || raw.schedules.length !== normalized.schedules.length) return false;
  return raw.schedules.every((schedule, index) => storedTemplateSchedulePreserved(schedule, normalized.schedules[index]));
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
    if (!storedTemplatePreserved(parsed[index], templates[index])) return { ok: false, templates: [] };
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
