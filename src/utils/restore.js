import {
  EXPERIMENT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  REMINDER_NOTIFIED_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
} from '../constants.js';
import { serializeExperiments } from './experiment.js';

export const BACKUP_RESTORED_EVENT = 'realitysync:backup-restored';
export const REALITY_SYNC_STORAGE_KEYS = Object.freeze([
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  REMINDER_NOTIFIED_STORAGE_KEY,
  EXPERIMENT_STORAGE_KEY,
]);

function restoreRawValue(storage, key, value) {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

function serializedRestoreEntries(data) {
  return [
    [STORAGE_KEY, JSON.stringify(data.scheduleStore)],
    [TEMPLATE_STORAGE_KEY, JSON.stringify(data.templates)],
    [EXPERIMENT_STORAGE_KEY, serializeExperiments(data.experiments ?? [])],
    [REMINDER_STORAGE_KEY, JSON.stringify(data.reminderPreferences)],
    [LEGACY_STORAGE_KEY, null],
    [REMINDER_NOTIFIED_STORAGE_KEY, null],
  ];
}

export function persistRestoredBackup(data, storage = globalThis.window?.localStorage) {
  if (!storage || !data) return { ok: false, rollbackOk: true };

  let entries;
  try {
    entries = serializedRestoreEntries(data);
  } catch {
    return { ok: false, rollbackOk: true };
  }

  const previous = new Map();
  try {
    for (const [key] of entries) previous.set(key, storage.getItem(key));
  } catch {
    // If current storage cannot be read, do not start a destructive restore.
    return { ok: false, rollbackOk: true };
  }

  const changedKeys = [];
  try {
    for (const [key, value] of entries) {
      restoreRawValue(storage, key, value);
      changedKeys.push(key);
    }
    return { ok: true, rollbackOk: true };
  } catch {
    let rollbackOk = true;
    for (const key of changedKeys.reverse()) {
      try {
        restoreRawValue(storage, key, previous.get(key) ?? null);
      } catch {
        rollbackOk = false;
      }
    }
    return { ok: false, rollbackOk };
  }
}

export function eraseStoredRealitySyncDataResult(storage = globalThis.window?.localStorage) {
  if (!storage) return { ok: false, rollbackOk: true };

  const previous = new Map();
  try {
    for (const key of REALITY_SYNC_STORAGE_KEYS) previous.set(key, storage.getItem(key));
  } catch {
    // Never begin a destructive erase when the current state cannot first be
    // snapshotted for rollback.
    return { ok: false, rollbackOk: true };
  }

  try {
    for (const key of REALITY_SYNC_STORAGE_KEYS) storage.removeItem(key);
    for (const key of REALITY_SYNC_STORAGE_KEYS) {
      if (storage.getItem(key) !== null) throw new Error('erase verification failed');
    }
    return { ok: true, rollbackOk: true };
  } catch {
    let rollbackOk = true;
    // Restore every domain, not only the keys whose removeItem call returned.
    // A storage implementation may have mutated before reporting failure.
    for (const key of REALITY_SYNC_STORAGE_KEYS) {
      try {
        restoreRawValue(storage, key, previous.get(key) ?? null);
      } catch {
        rollbackOk = false;
      }
    }
    for (const key of REALITY_SYNC_STORAGE_KEYS) {
      try {
        if (storage.getItem(key) !== (previous.get(key) ?? null)) rollbackOk = false;
      } catch {
        rollbackOk = false;
      }
    }
    return { ok: false, rollbackOk };
  }
}

export function eraseStoredRealitySyncData(storage = globalThis.window?.localStorage) {
  return eraseStoredRealitySyncDataResult(storage).ok;
}
