import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORAGE_VERSION } from '../src/constants.js';
import { mergeScheduleStoreWrite } from '../src/utils/storage.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function plan(id, title) {
  return {
    id,
    time: '09:00',
    title,
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    appliedExperimentIds: [],
    status: 'pending',
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };
}

test('schedule write merges only dirty days onto the latest persisted store', () => {
  const baseDay = [plan('a', 'Base A')];
  const localDay = [plan('a', 'Local A')];
  const remoteOtherDay = [plan('b', 'Remote B')];
  const latestStore = {
    version: STORAGE_VERSION,
    days: {
      '2026-08-28': baseDay,
      '2026-08-29': remoteOtherDay,
    },
  };
  const localStore = {
    version: STORAGE_VERSION,
    days: {
      '2026-08-28': localDay,
    },
  };

  const merged = mergeScheduleStoreWrite(
    latestStore,
    localStore,
    ['2026-08-28'],
    { '2026-08-28': baseDay },
  );

  assert.equal(merged.ok, true);
  assert.equal(merged.store.days['2026-08-28'][0].title, 'Local A');
  assert.equal(merged.store.days['2026-08-29'][0].title, 'Remote B');
});

test('same-day remote edits are detected rather than overwritten', () => {
  const baseDay = [plan('a', 'Base')];
  const latestStore = {
    version: STORAGE_VERSION,
    days: { '2026-08-28': [plan('a', 'Remote')] },
  };
  const localStore = {
    version: STORAGE_VERSION,
    days: { '2026-08-28': [plan('a', 'Local')] },
  };

  const merged = mergeScheduleStoreWrite(
    latestStore,
    localStore,
    ['2026-08-28'],
    { '2026-08-28': baseDay },
  );

  assert.equal(merged.ok, false);
  assert.deepEqual(merged.conflictDateKeys, ['2026-08-28']);
  assert.equal(merged.store.days['2026-08-28'][0].title, 'Remote');
});

test('schedule hook preserves dirty local days across external storage events and surfaces conflicts', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  const app = source('src/App.jsx');
  assert.match(hook, /const merged = mergeScheduleStoreWrite\(/);
  assert.match(hook, /current\.dirtyDateKeys/);
  assert.match(hook, /writeConflict: true/);
  assert.match(hook, /currentState\.persistenceBlocked \|\| currentState\.writeConflict/);
  assert.match(app, /別の画面との編集競合を検出しました/);
  assert.match(app, /storageProtection\.writeConflict/);
});
