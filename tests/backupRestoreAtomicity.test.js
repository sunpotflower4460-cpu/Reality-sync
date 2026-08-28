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
  // The injected storage also refuses rollback of the failing key itself, so
  // rollbackOk is false, but every key that could be restored is returned.
  assert.equal(result.rollbackOk, false);
  const snapshot = storage.snapshot();
  assert.equal(snapshot[STORAGE_KEY], initial[STORAGE_KEY]);
  assert.equal(snapshot[TEMPLATE_STORAGE_KEY], initial[TEMPLATE_STORAGE_KEY]);
  assert.equal(snapshot[REMINDER_STORAGE_KEY], initial[REMINDER_STORAGE_KEY]);
  assert.equal(snapshot[LEGACY_STORAGE_KEY], initial[LEGACY_STORAGE_KEY]);
  assert.equal(snapshot[REMINDER_NOTIFIED_STORAGE_KEY], initial[REMINDER_NOTIFIED_STORAGE_KEY]);
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
