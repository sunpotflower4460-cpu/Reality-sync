import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eraseStoredRealitySyncData,
  eraseStoredRealitySyncDataResult,
  REALITY_SYNC_STORAGE_KEYS,
} from '../src/utils/restore.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function fakeStorage(initial = {}, failingRemoveKey = null, failingSetKey = null) {
  const values = new Map(Object.entries(initial));
  const removals = [];
  const writes = [];
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      writes.push(key);
      if (key === failingSetKey) throw new Error('set failed');
      values.set(key, String(value));
    },
    removeItem(key) {
      removals.push(key);
      if (key === failingRemoveKey) throw new Error('remove failed');
      values.delete(key);
    },
    removals,
    writes,
    snapshot() { return Object.fromEntries(values); },
  };
}

test('partial erase failure rolls every RealitySync storage domain back to its original value', () => {
  const initial = Object.fromEntries(REALITY_SYNC_STORAGE_KEYS.map((key) => [key, `value:${key}`]));
  const failingKey = REALITY_SYNC_STORAGE_KEYS[1];
  const storage = fakeStorage(initial, failingKey);
  const result = eraseStoredRealitySyncDataResult(storage);

  assert.deepEqual(result, { ok: false, rollbackOk: true });
  assert.deepEqual(storage.snapshot(), initial);
  assert.equal(storage.removals.includes(REALITY_SYNC_STORAGE_KEYS[0]), true);
  assert.equal(storage.removals.includes(failingKey), true);
  assert.equal(storage.removals.includes(REALITY_SYNC_STORAGE_KEYS.at(-1)), false);
});

test('erase reports a failed rollback instead of pretending partially restored storage is safe', () => {
  const initial = Object.fromEntries(REALITY_SYNC_STORAGE_KEYS.map((key) => [key, `value:${key}`]));
  const storage = fakeStorage(initial, REALITY_SYNC_STORAGE_KEYS[1], REALITY_SYNC_STORAGE_KEYS[0]);
  assert.deepEqual(eraseStoredRealitySyncDataResult(storage), { ok: false, rollbackOk: false });
  assert.notDeepEqual(storage.snapshot(), initial);
});

test('erase reports success only after every RealitySync key is actually absent', () => {
  const initial = Object.fromEntries(REALITY_SYNC_STORAGE_KEYS.map((key) => [key, `value:${key}`]));
  const storage = fakeStorage(initial);
  assert.deepEqual(eraseStoredRealitySyncDataResult(storage), { ok: true, rollbackOk: true });
  assert.equal(eraseStoredRealitySyncData(fakeStorage(initial)), true);
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
