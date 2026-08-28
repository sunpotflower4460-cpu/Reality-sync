import { useCallback, useEffect, useRef, useState } from 'react';
import { TEMPLATE_STORAGE_KEY } from '../constants.js';
import { createUniqueId } from '../utils/id.js';
import { createTemplateFromSchedules, parseStoredTemplatesResult } from '../utils/template.js';

function validateTemplates(next) {
  if (!Array.isArray(next)) return null;
  const result = parseStoredTemplatesResult(JSON.stringify(next));
  return result.ok ? result.templates : null;
}

function serializeTemplates(templates) {
  return JSON.stringify(templates);
}

function loadTemplateState() {
  if (typeof window === 'undefined') {
    return {
      templates: [],
      persistenceBlocked: false,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: '[]',
      writeConflict: false,
    };
  }
  try {
    const result = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
    return {
      templates: result.templates,
      persistenceBlocked: !result.ok,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializeTemplates(result.templates),
      writeConflict: false,
    };
  } catch {
    // Do not treat an unreadable storage area as empty: a later write could
    // otherwise erase templates that this tab never successfully read.
    return {
      templates: [],
      persistenceBlocked: true,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: '[]',
      writeConflict: false,
    };
  }
}

export function useScheduleTemplates() {
  const [state, setState] = useState(loadTemplateState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const applyState = useCallback((updater) => {
    const current = stateRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    stateRef.current = next;
    setState(next);
    return next;
  }, []);
  const {
    templates,
    persistenceBlocked,
    writeFailed,
    needsWrite,
    baseSerialized,
    writeConflict,
  } = state;

  useEffect(() => {
    if (persistenceBlocked || writeConflict || !needsWrite) return;
    try {
      const latest = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
      if (!latest.ok) {
        applyState((current) => ({ ...current, persistenceBlocked: true, needsWrite: false }));
        return;
      }
      const latestSerialized = serializeTemplates(latest.templates);
      if (latestSerialized !== baseSerialized) {
        applyState((current) => ({ ...current, writeConflict: true, writeFailed: false, needsWrite: false }));
        return;
      }

      const writtenSerialized = serializeTemplates(templates);
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, writtenSerialized);
      applyState((current) => {
        const currentSerialized = serializeTemplates(current.templates);
        const changedAgain = currentSerialized !== writtenSerialized;
        return {
          ...current,
          writeFailed: false,
          needsWrite: changedAgain,
          baseSerialized: writtenSerialized,
        };
      });
    } catch {
      applyState((current) => current.writeFailed ? current : { ...current, writeFailed: true });
    }
  }, [applyState, baseSerialized, needsWrite, persistenceBlocked, templates, writeConflict]);

  useEffect(() => {
    const syncTemplates = (event) => {
      if (event.key !== TEMPLATE_STORAGE_KEY) return;
      const result = parseStoredTemplatesResult(event.newValue);
      applyState((current) => {
        if (!result.ok) {
          return { ...current, persistenceBlocked: true, writeFailed: false, needsWrite: false };
        }
        const externalSerialized = serializeTemplates(result.templates);
        if (current.needsWrite) {
          if (externalSerialized !== current.baseSerialized) {
            return { ...current, writeConflict: true, writeFailed: false, needsWrite: false };
          }
          return current;
        }
        if (current.writeConflict) return current;
        return {
          templates: result.templates,
          persistenceBlocked: false,
          writeFailed: false,
          needsWrite: false,
          baseSerialized: externalSerialized,
          writeConflict: false,
        };
      });
    };
    window.addEventListener('storage', syncTemplates);
    return () => window.removeEventListener('storage', syncTemplates);
  }, [applyState]);

  // Keep same-frame repeated UI actions on one synchronous source of truth.
  // This prevents a double click from allocating against the same stale list.
  const updateTemplates = useCallback((updater) => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return false;
    const next = typeof updater === 'function' ? updater(current.templates) : updater;
    const validated = validateTemplates(next);
    if (!validated) return false;
    applyState({ ...current, templates: validated, needsWrite: true });
    return true;
  }, [applyState]);

  const saveTemplate = useCallback((name, schedules) => (
    updateTemplates((current) => {
      const id = createUniqueId('template', current.map((template) => template.id));
      const template = createTemplateFromSchedules(name, schedules, id);
      return template ? [template, ...current] : null;
    })
  ), [updateTemplates]);

  const deleteTemplate = useCallback((templateId) => (
    updateTemplates((current) => {
      if (!current.some((template) => template.id === templateId)) return null;
      return current.filter((template) => template.id !== templateId);
    })
  ), [updateTemplates]);

  const replaceTemplates = useCallback((nextTemplates) => {
    const validated = validateTemplates(Array.isArray(nextTemplates) ? nextTemplates : []);
    if (!validated) return false;
    applyState({
      templates: validated,
      persistenceBlocked: false,
      writeFailed: false,
      needsWrite: false,
      baseSerialized: serializeTemplates(validated),
      writeConflict: false,
    });
    return true;
  }, [applyState]);

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    replaceTemplates,
    storageProtection: { persistenceBlocked, writeFailed, writeConflict },
  };
}
