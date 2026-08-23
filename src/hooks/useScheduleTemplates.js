import { useCallback, useEffect, useState } from 'react';
import { TEMPLATE_STORAGE_KEY } from '../constants.js';
import { createTemplateFromSchedules, normalizeTemplates, parseStoredTemplates } from '../utils/template.js';

function createTemplateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadTemplates() {
  if (typeof window === 'undefined') return [];
  try {
    return parseStoredTemplates(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function useScheduleTemplates() {
  const [templates, setTemplates] = useState(loadTemplates);

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // In-memory template mode remains usable when storage is unavailable.
    }
  }, [templates]);

  useEffect(() => {
    const syncTemplates = (event) => {
      if (event.key !== TEMPLATE_STORAGE_KEY) return;
      setTemplates(parseStoredTemplates(event.newValue));
    };
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, []);

  const saveTemplate = useCallback((name, schedules) => {
    const template = createTemplateFromSchedules(name, schedules, createTemplateId());
    if (!template) return false;
    setTemplates((current) => [...current, template]);
    return true;
  }, []);

  const deleteTemplate = useCallback((templateId) => {
    setTemplates((current) => current.filter((template) => template.id !== templateId));
  }, []);

  const replaceTemplates = useCallback((nextTemplates) => {
    setTemplates(normalizeTemplates(nextTemplates));
  }, []);

  return { templates, saveTemplate, deleteTemplate, replaceTemplates };
}
