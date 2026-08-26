import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SCHEDULES } from '../src/data/demoSchedules.js';
import { STATUS } from '../src/constants.js';
import {
  migrateLegacySchedules,
  parseStoredScheduleStore,
  parseStoredScheduleStoreResult,
  parseStoredSchedules,
} from '../src/utils/storage.js';

test('malformed legacy JSON falls back to clean demo schedules', () => {
  const schedules = parseStoredSchedules('{not-json', INITIAL_SCHEDULES);
  assert.equal(schedules.length, INITIAL_SCHEDULES.length);
  assert.equal(schedules.every((schedule) => schedule.status === STATUS.PENDING), true);
});

test('an explicitly empty legacy list remains empty instead of restoring demo schedules', () => {
  const schedules = parseStoredSchedules('[]', INITIAL_SCHEDULES);
  assert.deepEqual(schedules, []);
});

test('legacy stored records normalize plan fields but do not fabricate invalid actual-only fields', () => {
  const raw = JSON.stringify([{
    id: 1,
    time: '77:77',
    title: 'Morning run',
    category: '運動',
    duration: -30,
    plannedStress: 900,
    status: STATUS.AS_PLANNED,
    actualDuration: 2000,
    actualStress: -10,
  }]);

  const [schedule] = parseStoredSchedules(raw, INITIAL_SCHEDULES);
  assert.equal(schedule.time, '07:00');
  assert.equal(schedule.duration, 0);
  assert.equal(schedule.plannedStress, 100);
  assert.equal(schedule.actualDuration, null);
  assert.equal(schedule.actualStress, null);
});

test('v2 storage preserves independent valid days', () => {
  const raw = JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [{ id: 'a', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.PENDING }],
      '2026-08-24': [],
    },
  });

  const result = parseStoredScheduleStoreResult(raw);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.store.days).sort(), ['2026-08-23', '2026-08-24']);
  assert.equal(result.store.days['2026-08-23'][0].title, 'Work');
  assert.deepEqual(result.store.days['2026-08-24'], []);
});

test('invalid day keys block persistence instead of being silently discarded', () => {
  const raw = JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [{ id: 'a', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.PENDING }],
      invalid: [{ id: 'bad' }],
    },
  });
  const result = parseStoredScheduleStoreResult(raw);
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedVersion, null);
  assert.deepEqual(result.store, { version: 2, days: {} });
});

test('schedule item loss blocks persistence instead of rewriting a partial day', () => {
  const raw = JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [
        { id: 'same', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.PENDING },
        { id: 'same', time: '10:00', title: 'Duplicate', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.PENDING },
      ],
    },
  });
  const result = parseStoredScheduleStoreResult(raw);
  assert.equal(result.ok, false);
  assert.deepEqual(result.store, { version: 2, days: {} });
});

test('unknown future storage versions are detected so persistence can be blocked', () => {
  const raw = JSON.stringify({
    version: 3,
    days: {
      '2026-08-23': [{ id: 'future', time: '09:00', title: 'Future field data', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.PENDING, futureField: 'keep-me' }],
    },
  });
  const result = parseStoredScheduleStoreResult(raw);
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedVersion, 3);
  assert.deepEqual(result.store, { version: 2, days: {} });
  assert.deepEqual(parseStoredScheduleStore(raw), { version: 2, days: {} });
});

test('malformed current storage is detected rather than treated as safely writable', () => {
  const result = parseStoredScheduleStoreResult('{broken');
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedVersion, null);
  assert.deepEqual(result.store, { version: 2, days: {} });
});

test('malformed v2 storage starts from an empty real-product store for read callers', () => {
  assert.deepEqual(parseStoredScheduleStore('{broken'), { version: 2, days: {} });
});

test('untouched old demo data is not migrated into the real product', () => {
  const store = migrateLegacySchedules(JSON.stringify(INITIAL_SCHEDULES), '2026-08-23', INITIAL_SCHEDULES);
  assert.deepEqual(store, { version: 2, days: {} });
});

test('meaningfully changed legacy data migrates to the migration day', () => {
  const changed = INITIAL_SCHEDULES.map((schedule, index) => index === 0 ? {
    ...schedule,
    status: STATUS.AS_PLANNED,
    actualTitle: schedule.title,
    actualCategory: schedule.category,
    actualDuration: schedule.duration,
    actualStress: schedule.plannedStress,
    mood: 'good',
  } : schedule);

  const store = migrateLegacySchedules(JSON.stringify(changed), '2026-08-23', INITIAL_SCHEDULES);
  assert.equal(store.days['2026-08-23'].length, INITIAL_SCHEDULES.length);
  assert.equal(store.days['2026-08-23'][0].status, STATUS.AS_PLANNED);
});
