import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERIMENT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  REMINDER_NOTIFIED_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  STORAGE_VERSION,
} from '../src/constants.js';
import { persistRestoredBackup } from '../src/utils/restore.js';

function backupData() {
  return {
    scheduleStore: { version: STORAGE_VERSION, days: {} },
    templates: [],
    experiments: [],
    reminderPreferences: { enabled: true, delayMinutes: 15, browserNotifications: false },
  };
}

function fakeStorage(initial = {}, failOnSetKey = null) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === failOnSetKey) throw new Error('write failed');
      values.set(key, String(value));
    },
    removeItem(key) {
      if (key === failOnSetKey) throw new Error('remove failed');
      values.delete(key);
    },
    snapshot() { return Object.fromEntries(values); },
  };
}

test('backup restore persists all primary domains and clears legacy notification caches', () => {
  const storage = fakeStorage({
    [LEGACY_STORAGE_KEY]: '[{"old":true}]',
    [REMINDER_NOTIFIED_STORAGE_KEY]: '["2026-08-28::old"]',
  });
  const result = persistRestoredBackup(backupData(), storage);
  assert.equal(result.ok, true);
  const snapshot = storage.snapshot();
  assert.ok(snapshot[STORAGE_KEY]);
  assert.equal(snapshot[TEMPLATE_STORAGE_KEY], '[]');
  assert.ok(snapshot[EXPERIMENT_STORAGE_KEY]);
  assert.ok(snapshot[REMINDER_STORAGE_KEY]);
  assert.equal(LEGACY_STORAGE_KEY in snapshot, false);
  assert.equal(REMINDER_NOTIFIED_STORAGE_KEY in snapshot, false);
});

test('partial restore write failure rolls already-written domains back to their original values', () => {
  const initial = {
    [STORAGE_KEY]: 'old-schedules',
    [TEMPLATE_STORAGE_KEY]: 'old-templates',
    [EXPERIMENT_STORAGE_KEY]: 'old-experiments',
    [REMINDER_STORAGE_KEY]: 'old-reminders',
    [LEGACY_STORAGE_KEY]: 'old-legacy',
    [REMINDER_NOTIFIED_STORAGE_KEY]: 'old-notified',
  };
  const storage = fakeStorage(initial, EXPERIMENT_STORAGE_KEY);
  const result = persistRestoredBackup(backupData(), storage);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackOk, true);
  assert.deepEqual(storage.snapshot(), initial);
});

test('restore verifies read-back and rolls back a silent no-op storage write', () => {
  const initial = {
    [STORAGE_KEY]: 'old-schedules',
    [TEMPLATE_STORAGE_KEY]: 'old-templates',
    [EXPERIMENT_STORAGE_KEY]: 'old-experiments',
    [REMINDER_STORAGE_KEY]: 'old-reminders',
    [LEGACY_STORAGE_KEY]: 'old-legacy',
    [REMINDER_NOTIFIED_STORAGE_KEY]: 'old-notified',
  };
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === TEMPLATE_STORAGE_KEY) return;
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };

  assert.deepEqual(persistRestoredBackup(backupData(), storage), { ok: false, rollbackOk: true });
  assert.deepEqual(storage.snapshot(), initial);
});

test('restore rolls back a key even when storage mutates before throwing', () => {
  const initial = {
    [STORAGE_KEY]: 'old-schedules',
    [TEMPLATE_STORAGE_KEY]: 'old-templates',
    [EXPERIMENT_STORAGE_KEY]: 'old-experiments',
    [REMINDER_STORAGE_KEY]: 'old-reminders',
    [LEGACY_STORAGE_KEY]: 'old-legacy',
    [REMINDER_NOTIFIED_STORAGE_KEY]: 'old-notified',
  };
  const values = new Map(Object.entries(initial));
  let throwOnce = true;
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      values.set(key, String(value));
      if (key === EXPERIMENT_STORAGE_KEY && throwOnce) {
        throwOnce = false;
        throw new Error('mutated before reporting failure');
      }
    },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };

  assert.deepEqual(persistRestoredBackup(backupData(), storage), { ok: false, rollbackOk: true });
  assert.deepEqual(storage.snapshot(), initial);
});

test('restore does not overwrite a third value that appears concurrently during verification', () => {
  const initial = {
    [STORAGE_KEY]: 'old-schedules',
    [TEMPLATE_STORAGE_KEY]: 'old-templates',
    [EXPERIMENT_STORAGE_KEY]: 'old-experiments',
    [REMINDER_STORAGE_KEY]: 'old-reminders',
    [LEGACY_STORAGE_KEY]: 'old-legacy',
    [REMINDER_NOTIFIED_STORAGE_KEY]: 'old-notified',
  };
  const values = new Map(Object.entries(initial));
  let writeCount = 0;
  let injected = false;
  const storage = {
    getItem(key) {
      if (writeCount === 6 && key === STORAGE_KEY && !injected) {
        injected = true;
        values.set(TEMPLATE_STORAGE_KEY, 'remote-concurrent-template');
      }
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      writeCount += 1;
      values.set(key, String(value));
    },
    removeItem(key) {
      writeCount += 1;
      values.delete(key);
    },
    snapshot() { return Object.fromEntries(values); },
  };

  const result = persistRestoredBackup(backupData(), storage);
  assert.deepEqual(result, { ok: false, rollbackOk: false });
  assert.equal(storage.snapshot()[TEMPLATE_STORAGE_KEY], 'remote-concurrent-template');
});

test('restore never starts if existing storage cannot be read safely', () => {
  let writes = 0;
  const storage = {
    getItem() { throw new Error('read failed'); },
    setItem() { writes += 1; },
    removeItem() { writes += 1; },
  };
  const result = persistRestoredBackup(backupData(), storage);
  assert.deepEqual(result, { ok: false, rollbackOk: true });
  assert.equal(writes, 0);
});
