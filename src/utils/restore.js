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

function rollbackAttemptedEntries(storage, entries, previous) {
  let rollbackOk = true;

  // Do not blindly overwrite a third value that appeared while the destructive
  // operation was running. It may be a concurrent write from another
  // RealitySync tab. Only undo values that are still either our attempted value
  // or the original one.
  for (const [key, attemptedValue] of [...entries].reverse()) {
    const previousValue = previous.get(key) ?? null;
    try {
      const currentValue = storage.getItem(key);
      if (currentValue === previousValue) continue;
      if (currentValue !== attemptedValue) {
        rollbackOk = false;
        continue;
      }
      restoreRawValue(storage, key, previousValue);
    } catch {
      rollbackOk = false;
    }
  }

  for (const [key] of entries) {
    try {
      if (storage.getItem(key) !== (previous.get(key) ?? null)) rollbackOk = false;
    } catch {
      rollbackOk = false;
    }
  }
  return rollbackOk;
}

function entryStillMatchesSnapshot(storage, previous, key) {
  return storage.getItem(key) === (previous.get(key) ?? null);
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

  try {
    for (const [key, value] of entries) {
      // Another tab can update a key after our initial snapshot but before this
      // particular domain is written. Recheck each untouched key immediately
      // before replacing it so a successful restore cannot silently erase a
      // newer concurrent value merely because our final read-back matches ours.
      if (!entryStillMatchesSnapshot(storage, previous, key)) {
        throw new Error('restore concurrent write detected');
      }
      restoreRawValue(storage, key, value);
    }
    // A storage implementation can theoretically return from set/remove without
    // persisting the requested value. Never report a destructive restore as
    // successful until every domain can be read back exactly as written.
    for (const [key, value] of entries) {
      if (storage.getItem(key) !== value) throw new Error('restore verification failed');
    }
    return { ok: true, rollbackOk: true };
  } catch {
    return { ok: false, rollbackOk: rollbackAttemptedEntries(storage, entries, previous) };
  }
}

export function eraseStoredRealitySyncDataResult(storage = globalThis.window?.localStorage) {
  if (!storage) return { ok: false, rollbackOk: true };

  const eraseEntries = REALITY_SYNC_STORAGE_KEYS.map((key) => [key, null]);
  const previous = new Map();
  try {
    for (const [key] of eraseEntries) previous.set(key, storage.getItem(key));
  } catch {
    // Never begin a destructive erase when the current state cannot first be
    // snapshotted for rollback.
    return { ok: false, rollbackOk: true };
  }

  try {
    for (const [key] of eraseEntries) {
      // As with restore, refuse to erase a value that another tab changed after
      // the initial snapshot but before this key's destructive write.
      if (!entryStillMatchesSnapshot(storage, previous, key)) {
        throw new Error('erase concurrent write detected');
      }
      storage.removeItem(key);
    }
    for (const [key] of eraseEntries) {
      if (storage.getItem(key) !== null) throw new Error('erase verification failed');
    }
    return { ok: true, rollbackOk: true };
  } catch {
    return { ok: false, rollbackOk: rollbackAttemptedEntries(storage, eraseEntries, previous) };
  }
}

export function eraseStoredRealitySyncData(storage = globalThis.window?.localStorage) {
  return eraseStoredRealitySyncDataResult(storage).ok;
}
