import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_SCHEDULES,
  STORAGE_KEY,
  applyRecord,
  calculateStats,
  loadSchedules,
  saveSchedules,
} from '../src/scheduleModel.js';

test('changed record requires a replacement activity', () => {
  const result = applyRecord(INITIAL_SCHEDULES[0], {
    recordMode: 'changed',
    actualTitle: '   ',
    actualCategory: '趣味',
    mood: 'good',
    actualStress: 20,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /代わりに行ったこと/);
});

test('changed activity is counted as actual time in its new category', () => {
  const changed = applyRecord(INITIAL_SCHEDULES[0], {
    recordMode: 'changed',
    actualTitle: '読書',
    actualCategory: '趣味',
    mood: 'good',
    actualStress: 25,
  });
  assert.equal(changed.ok, true);

  const stats = calculateStats([changed.schedule]);
  assert.deepEqual(stats.categories['運動'], { ideal: 30, actual: 0 });
  assert.deepEqual(stats.categories['趣味'], { ideal: 0, actual: 30 });
});

test('skipped time remains visible as rest/skip instead of disappearing', () => {
  const skipped = applyRecord(INITIAL_SCHEDULES[1], {
    recordMode: 'skipped',
    mood: 'bad',
    actualStress: 90,
  });
  const stats = calculateStats([skipped.schedule]);

  assert.deepEqual(stats.categories['休息・スキップ'], { ideal: 0, actual: 120 });
});

test('stress values are clamped to the 0-100 domain', () => {
  const result = applyRecord(INITIAL_SCHEDULES[0], {
    recordMode: 'as_planned',
    mood: 'normal',
    actualStress: 150,
  });

  assert.equal(result.schedule.actualStress, 100);
});

test('storage roundtrip and invalid-storage fallback are safe', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(saveSchedules(INITIAL_SCHEDULES, storage), true);
  assert.equal(values.has(STORAGE_KEY), true);
  assert.deepEqual(loadSchedules(storage), INITIAL_SCHEDULES);

  values.set(STORAGE_KEY, '{broken json');
  assert.deepEqual(loadSchedules(storage), INITIAL_SCHEDULES);
});
