import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eraseStoredRealitySyncData, REALITY_SYNC_STORAGE_KEYS } from '../src/utils/restore.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function fakeStorage(initial = {}, failingKey = null) {
  const values = new Map(Object.entries(initial));
  const removals = [];
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    removeItem(key) {
      removals.push(key);
      if (key === failingKey) throw new Error('remove failed');
      values.delete(key);
    },
    removals,
    snapshot() { return Object.fromEntries(values); },
  };
}

test('erase attempts every RealitySync storage key even if one removal throws', () => {
  const initial = Object.fromEntries(REALITY_SYNC_STORAGE_KEYS.map((key) => [key, `value:${key}`]));
  const failingKey = REALITY_SYNC_STORAGE_KEYS[1];
  const storage = fakeStorage(initial, failingKey);
  assert.equal(eraseStoredRealitySyncData(storage), false);
  assert.deepEqual(storage.removals, REALITY_SYNC_STORAGE_KEYS);
  assert.equal(storage.getItem(failingKey), initial[failingKey]);
  for (const key of REALITY_SYNC_STORAGE_KEYS) {
    if (key !== failingKey) assert.equal(storage.getItem(key), null);
  }
});

test('erase reports success only after every RealitySync key is actually absent', () => {
  const initial = Object.fromEntries(REALITY_SYNC_STORAGE_KEYS.map((key) => [key, `value:${key}`]));
  const storage = fakeStorage(initial);
  assert.equal(eraseStoredRealitySyncData(storage), true);
  assert.deepEqual(storage.snapshot(), {});
});

test('settings verifies destructive storage removal before displaying success', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const eraseCall = settings.indexOf('const erased = eraseStoredRealitySyncData()');
  const successCopy = settings.indexOf('この端末のRealitySyncデータを削除しました。', eraseCall);
  assert.ok(eraseCall >= 0);
  assert.ok(successCopy > eraseCall);
  assert.match(settings.slice(eraseCall, successCopy), /if \(!erased\)/);
});
