import { useCallback, useEffect, useState } from 'react';
import { TEMPLATE_STORAGE_KEY } from '../constants.js';
import { createUniqueId } from '../utils/id.js';
import { createTemplateFromSchedules, parseStoredTemplatesResult } from '../utils/template.js';

function validateTemplates(next) {
  if (!Array.isArray(next)) return null;
  const result = parseStoredTemplatesResult(JSON.stringify(next));
  return result.ok ? result.templates : null;
}

function loadTemplateState() {
  if (typeof window === 'undefined') return { templates: [], persistenceBlocked: false, writeFailed: false };
  try {
    const result = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
    return { templates: result.templates, persistenceBlocked: !result.ok, writeFailed: false };
  } catch {
    return { templates: [], persistenceBlocked: false, writeFailed: true };
  }
}

export function useScheduleTemplates() {
  const [state, setState] = useState(loadTemplateState);
  const { templates, persistenceBlocked, writeFailed } = state;

  useEffect(() => {
    if (persistenceBlocked) return;
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
      setState((current) => current.writeFailed ? { ...current, writeFailed: false } : current);
    } catch {
      setState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [persistenceBlocked, templates]);

  useEffect(() => {
    const syncTemplates = (event) => {
      if (event.key !== TEMPLATE_STORAGE_KEY) return;
      const result = parseStoredTemplatesResult(event.newValue);
      setState({ templates: result.templates, persistenceBlocked: !result.ok, writeFailed: false });
    };
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  const updateTemplates = useCallback((updater) => {
    setState((current) => {
      if (current.persistenceBlocked) return current;
      const next = typeof updater === 'function' ? updater(current.templates) : updater;
      const validated = validateTemplates(next);
      if (!validated) return current;
      return { ...current, templates: validated };
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
    const validated = validateTemplates(Array.isArray(nextTemplates) ? nextTemplates : []);
    if (!validated) return;
    setState({ templates: validated, persistenceBlocked: false, writeFailed: false });
  }, []);

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    replaceTemplates,
    storageProtection: { persistenceBlocked, writeFailed },
  };
}
