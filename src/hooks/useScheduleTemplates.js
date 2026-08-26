import { useCallback, useEffect, useState } from 'react';
import { TEMPLATE_STORAGE_KEY } from '../constants.js';
import { createTemplateFromSchedules, normalizeTemplates, parseStoredTemplatesResult } from '../utils/template.js';

function createTemplateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
      return { ...current, templates: normalizeTemplates(next) };
    });
  }, []);

  const saveTemplate = useCallback((name, schedules) => {
    if (persistenceBlocked) return false;
    const template = createTemplateFromSchedules(name, schedules, createTemplateId());
    if (!template) return false;
    updateTemplates((current) => [...current, template]);
    return true;
  }, [persistenceBlocked, updateTemplates]);

  const deleteTemplate = useCallback((templateId) => {
    updateTemplates((current) => current.filter((template) => template.id !== templateId));
  }, [updateTemplates]);

  const replaceTemplates = useCallback((nextTemplates) => {
    setState({ templates: normalizeTemplates(nextTemplates), persistenceBlocked: false });
  }, []);

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    replaceTemplates,
    storageProtection: { persistenceBlocked },
  };
}
