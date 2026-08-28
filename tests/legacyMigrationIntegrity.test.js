import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS } from '../src/constants.js';
import { INITIAL_SCHEDULES } from '../src/data/demoSchedules.js';
import { migrateLegacySchedulesResult } from '../src/utils/storage.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('malformed legacy storage is protected instead of migrated to empty data', () => {
  for (const raw of ['{broken', JSON.stringify({ schedules: [] })]) {
    const result = migrateLegacySchedulesResult(raw, '2026-08-28', INITIAL_SCHEDULES);
    assert.equal(result.ok, false);
    assert.deepEqual(result.store.days, {});
  }
});

test('legacy rows that would be repaired or dropped are protected from destructive migration', () => {
  const invalidTime = [{
    ...INITIAL_SCHEDULES[0],
    time: '25:00',
  }];
  const duplicates = [
    { ...INITIAL_SCHEDULES[0], id: 'same' },
    { ...INITIAL_SCHEDULES[1], id: 'same' },
  ];

  assert.equal(migrateLegacySchedulesResult(JSON.stringify(invalidTime), '2026-08-28', INITIAL_SCHEDULES).ok, false);
  assert.equal(migrateLegacySchedulesResult(JSON.stringify(duplicates), '2026-08-28', INITIAL_SCHEDULES).ok, false);
});

test('valid meaningful legacy reality migrates without changing its facts', () => {
  const changed = INITIAL_SCHEDULES.map((schedule, index) => index === 0 ? {
    ...schedule,
    status: STATUS.AS_PLANNED,
    actualTitle: schedule.title,
    actualCategory: schedule.category,
    actualDuration: schedule.duration,
    mood: 'good',
    actualStress: schedule.plannedStress,
  } : schedule);

  const result = migrateLegacySchedulesResult(JSON.stringify(changed), '2026-08-28', INITIAL_SCHEDULES);
  assert.equal(result.ok, true);
  assert.equal(result.store.days['2026-08-28'][0].status, STATUS.AS_PLANNED);
  assert.equal(result.store.days['2026-08-28'][0].actualDuration, 30);
});

test('pristine historical demo storage remains safely discardable', () => {
  const result = migrateLegacySchedulesResult(JSON.stringify(INITIAL_SCHEDULES), '2026-08-28', INITIAL_SCHEDULES);
  assert.equal(result.ok, true);
  assert.deepEqual(result.store.days, {});
});

test('schedule hook blocks persistence when legacy migration is unsafe', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  assert.match(hook, /migrateLegacySchedulesResult/);
  assert.match(hook, /persistenceBlocked: !migration\.ok/);
  assert.match(hook, /if \(persistenceBlocked \|\| writeConflict \|\| !needsWrite\) return;/);
  assert.ok(hook.indexOf('if (persistenceBlocked || writeConflict || !needsWrite) return;') < hook.indexOf('removeItem(LEGACY_STORAGE_KEY)'));
  assert.match(hook, /needsWrite: Boolean\(legacyRaw\) && migration\.ok/);
});
