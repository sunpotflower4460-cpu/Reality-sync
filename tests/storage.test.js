import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SCHEDULES } from '../src/data/demoSchedules.js';
import { STATUS } from '../src/constants.js';
import {
  migrateLegacySchedules,
  migrateLegacySchedulesResult,
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

test('field-level plan corruption blocks persistence instead of silently clamping facts', () => {
  for (const corrupt of [
    { duration: 0 },
    { duration: 2000 },
    { plannedStress: -1 },
    { time: '25:00' },
    { category: 'unknown-category' },
  ]) {
    const raw = JSON.stringify({
      version: 2,
      days: {
        '2026-08-23': [{
          id: 'a',
          time: '09:00',
          title: 'Work',
          category: '仕事',
          duration: 60,
          plannedStress: 40,
          status: STATUS.PENDING,
          ...corrupt,
        }],
      },
    });
    assert.equal(parseStoredScheduleStoreResult(raw).ok, false);
  }
});

test('planned duration must be at least one minute while an explicitly recorded zero-minute reality remains valid', () => {
  const recorded = {
    id: 'recorded-zero-actual',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 1,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Work', category: '仕事', duration: 1, plannedStress: 40 },
    actualTitle: 'Work',
    actualCategory: '仕事',
    actualDuration: 0,
  };
  const valid = parseStoredScheduleStoreResult(JSON.stringify({
    version: 2,
    days: { '2026-08-23': [recorded] },
  }));
  assert.equal(valid.ok, true);
  assert.equal(valid.store.days['2026-08-23'][0].actualDuration, 0);

  const zeroSnapshot = parseStoredScheduleStoreResult(JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [{
        ...recorded,
        duration: 60,
        plannedSnapshot: { ...recorded.plannedSnapshot, duration: 0 },
      }],
    },
  }));
  assert.equal(zeroSnapshot.ok, false);
});

test('legacy migration refuses zero-minute plans that the historical editor could not create', () => {
  const legacy = [{
    id: 'zero-plan',
    time: '09:00',
    title: 'Impossible plan',
    category: '仕事',
    duration: 0,
    plannedStress: 20,
    status: STATUS.PENDING,
  }];
  const result = migrateLegacySchedulesResult(JSON.stringify(legacy), '2026-08-23', INITIAL_SCHEDULES);
  assert.equal(result.ok, false);
  assert.deepEqual(result.store, { version: 2, days: {} });
});

test('record corruption that normalization would erase blocks persistence', () => {
  const base = {
    id: 'recorded',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    actualTitle: 'Work',
    actualCategory: '仕事',
    actualDuration: 60,
    actualStress: 35,
    mood: 'good',
  };
  const corruptions = [
    { actualDuration: 9999 },
    { actualStress: -10 },
    { mood: 'mystery' },
    { actualStartTime: '99:99' },
    { actualStartTime: '09:10', actualStartDateKey: '2026-02-31' },
    { deviationReason: 'would be silently dropped' },
  ];

  for (const corruption of corruptions) {
    const raw = JSON.stringify({ version: 2, days: { '2026-08-23': [{ ...base, ...corruption }] } });
    assert.equal(parseStoredScheduleStoreResult(raw).ok, false);
  }
});

test('changed record missing its replacement title cannot silently turn back into pending', () => {
  const raw = JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [{
        id: 'changed',
        time: '09:00',
        title: 'Work',
        category: '仕事',
        duration: 60,
        plannedStress: 40,
        status: STATUS.CHANGED,
        actualDuration: 45,
        actualStress: 50,
      }],
    },
  });
  assert.equal(parseStoredScheduleStoreResult(raw).ok, false);
});

test('invalid planned snapshots and unknown per-item fields are protected from silent loss', () => {
  const base = {
    id: 'recorded',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    actualTitle: 'Work',
    actualCategory: '仕事',
    actualDuration: 60,
  };

  const invalidSnapshot = JSON.stringify({
    version: 2,
    days: {
      '2026-08-23': [{
        ...base,
        plannedSnapshot: { time: '09:00', title: 'Work', category: '仕事', duration: null, plannedStress: 40 },
      }],
    },
  });
  const unknownField = JSON.stringify({
    version: 2,
    days: { '2026-08-23': [{ ...base, futureFact: 'do-not-drop-me' }] },
  });

  assert.equal(parseStoredScheduleStoreResult(invalidSnapshot).ok, false);
  assert.equal(parseStoredScheduleStoreResult(unknownField).ok, false);
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
