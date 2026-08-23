import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SCHEDULES } from '../src/data/demoSchedules.js';
import { STATUS } from '../src/constants.js';
import { parseStoredSchedules } from '../src/utils/storage.js';

test('malformed JSON falls back to clean demo schedules', () => {
  const schedules = parseStoredSchedules('{not-json', INITIAL_SCHEDULES);
  assert.equal(schedules.length, INITIAL_SCHEDULES.length);
  assert.equal(schedules.every((schedule) => schedule.status === STATUS.PENDING), true);
});

test('stored records are normalized before they reach the UI', () => {
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
  assert.equal(schedule.actualDuration, 1440);
  assert.equal(schedule.actualStress, 0);
});
