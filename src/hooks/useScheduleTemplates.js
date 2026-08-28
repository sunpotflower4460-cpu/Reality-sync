import { useCallback, useEffect, useState } from 'react';
import { TEMPLATE_STORAGE_KEY } from '../constants.js';
import { createUniqueId, hasDuplicateIds } from '../utils/id.js';
import { createTemplateFromSchedules, normalizeTemplates, parseStoredTemplatesResult } from '../utils/template.js';

function loadTemplateState() {
  if (typeof window === 'undefined') return { templates: [], persistenceBlocked: false };
  try {
    const result = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
    return { templates: result.templates, persistenceBlocked: !result.ok };
  } catch {
    return { templates: [], persistenceBlocked: false };
  }
}

export function useScheduleTemplates() {
  const [state, setState] = useState(loadTemplateState);
  const { templates, persistenceBlocked } = state;

  useEffect(() => {
    if (persistenceBlocked) return;
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // In-memory template mode remains usable when storage is unavailable.
    }
  }, [persistenceBlocked, templates]);

  useEffect(() => {
    const syncTemplates = (event) => {
      if (event.key !== TEMPLATE_STORAGE_KEY) return;
      const result = parseStoredTemplatesResult(event.newValue);
      setState({ templates: result.templates, persistenceBlocked: !result.ok });
    };
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  const updateTemplates = useCallback((updater) => {
    setState((current) => {
      if (current.persistenceBlocked) return current;
      const next = typeof updater === 'function' ? updater(current.templates) : updater;
      if (!Array.isArray(next) || hasDuplicateIds(next)) return current;
      const normalized = normalizeTemplates(next);
      if (normalized.length !== next.length) return current;
      return { ...current, templates: normalized };
    });
  }, []);

  const saveTemplate = useCallback((name, schedules) => {
    if (persistenceBlocked) return false;
    const id = createUniqueId('template', templates.map((template) => template.id));
    const template = createTemplateFromSchedules(name, schedules, id);
    if (!template) return false;
    updateTemplates((current) => [template, ...current]);
    return true;
  }, [persistenceBlocked, templates, updateTemplates]);

  const deleteTemplate = useCallback((templateId) => {
    updateTemplates((current) => current.filter((template) => template.id !== templateId));
  }, [updateTemplates]);

  const replaceTemplates = useCallback((nextTemplates) => {
    const candidate = Array.isArray(nextTemplates) ? nextTemplates : [];
    if (hasDuplicateIds(candidate)) return;
    const normalized = normalizeTemplates(candidate);
    if (normalized.length !== candidate.length) return;
    setState({ templates: normalized, persistenceBlocked: false });
  }, []);

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    replaceTemplates,
    storageProtection: { persistenceBlocked },
  };
}
