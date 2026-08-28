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
      // Re-check immediately before setItem so a storage change that arrived
      // after the first preflight is never overwritten as if nothing happened.
      const preWrite = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
      if (!preWrite.ok) {
        applyState((current) => ({ ...current, persistenceBlocked: true, needsWrite: false }));
        return;
      }
      const preWriteSerialized = serializeTemplates(preWrite.templates);
      if (preWriteSerialized !== latestSerialized) {
        applyState((current) => ({ ...current, writeConflict: true, writeFailed: false, needsWrite: false }));
        return;
      }

      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, writtenSerialized);
      const readBack = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
      if (!readBack.ok) {
        applyState((current) => ({ ...current, persistenceBlocked: true, needsWrite: false }));
        return;
      }
      const readBackSerialized = serializeTemplates(readBack.templates);
      if (readBackSerialized !== writtenSerialized) {
        if (readBackSerialized === preWriteSerialized) {
          applyState((current) => ({ ...current, writeFailed: true }));
        } else {
          applyState((current) => ({ ...current, writeConflict: true, writeFailed: false, needsWrite: false }));
        }
        return;
      }

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

  const latestStateBeforeMutation = useCallback(() => {
    const current = stateRef.current;
    if (current.persistenceBlocked || current.writeConflict) return null;
    try {
      const latest = parseStoredTemplatesResult(window.localStorage.getItem(TEMPLATE_STORAGE_KEY));
      if (!latest.ok) {
        applyState({ ...current, persistenceBlocked: true, needsWrite: false });
        return null;
      }
      const latestSerialized = serializeTemplates(latest.templates);
      if (latestSerialized === current.baseSerialized) return current;
      if (current.needsWrite) {
        applyState({ ...current, writeConflict: true, writeFailed: false, needsWrite: false });
        return null;
      }
      return {
        templates: latest.templates,
        persistenceBlocked: false,
        writeFailed: false,
        needsWrite: false,
        baseSerialized: latestSerialized,
        writeConflict: false,
      };
    } catch {
      applyState({ ...current, persistenceBlocked: true, needsWrite: false });
      return null;
    }
  }, [applyState]);

  // Keep same-frame repeated UI actions on one synchronous source of truth and
  // preflight device storage so an undelivered storage event cannot cause a
  // false-success mutation.
  const updateTemplates = useCallback((updater) => {
    const current = latestStateBeforeMutation();
    if (!current) return false;
    const next = typeof updater === 'function' ? updater(current.templates) : updater;
    const validated = validateTemplates(next);
    if (!validated) {
      if (current !== stateRef.current) applyState(current);
      return false;
    }
    applyState({ ...current, templates: validated, needsWrite: true });
    return true;
  }, [applyState, latestStateBeforeMutation]);

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

  // Destructive cross-domain consumers must not apply a template captured from
  // an older render. Re-read the template domain synchronously and require the
  // exact revision the user reviewed before returning a source object.
  const resolveTemplateForMutation = useCallback((templateId, expectedRevision) => {
    const current = latestStateBeforeMutation();
    if (!current) return null;
    const template = current.templates.find((item) => item.id === templateId) ?? null;
    const revisionMatches = template && JSON.stringify(template) === expectedRevision;
    if (current !== stateRef.current) applyState(current);
    return revisionMatches ? template : null;
  }, [applyState, latestStateBeforeMutation]);

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
    resolveTemplateForMutation,
    replaceTemplates,
    storageProtection: { persistenceBlocked, writeFailed, writeConflict },
  };
}
