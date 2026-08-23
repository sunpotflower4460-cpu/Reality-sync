import test from 'node:test';
import assert from 'node:assert/strict';
import { MOOD, STATUS } from '../src/constants.js';
import {
  calculateStats,
  createPendingScheduleCopy,
  createPlannedSnapshot,
  normalizeSchedule,
  recordedPlanForSchedule,
} from '../src/utils/schedule.js';

test('createPlannedSnapshot captures only the plan fields needed to preserve history', () => {
  const snapshot = createPlannedSnapshot({
    id: 'plan-1',
    time: '09:30',
    title: 'Deep work',
    category: '仕事',
    duration: 90,
    plannedStress: 65,
    status: STATUS.PENDING,
    actualTitle: 'must not leak',
  });
  assert.deepEqual(snapshot, {
    time: '09:30',
    title: 'Deep work',
    category: '仕事',
    duration: 90,
    plannedStress: 65,
  });
});

test('recorded plan snapshot survives later plan edits and drives ideal-side analytics', () => {
  const normalized = normalizeSchedule({
    id: 'recorded',
    time: '13:00',
    title: 'Edited later',
    category: '趣味',
    duration: 20,
    plannedStress: 10,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: {
      time: '09:00',
      title: 'Original work block',
      category: '仕事',
      duration: 120,
      plannedStress: 70,
    },
    actualTitle: 'Original work block',
    actualCategory: '仕事',
    actualDuration: 105,
    actualStress: 75,
    mood: MOOD.NORMAL,
  });

  assert.deepEqual(recordedPlanForSchedule(normalized), normalized.plannedSnapshot);
  const stats = calculateStats([normalized]);
  assert.equal(stats.categories['仕事'].ideal, 120);
  assert.equal(stats.categories['仕事'].actual, 105);
  assert.equal(stats.categories['趣味'], undefined);
});

test('legacy recorded data without a planned snapshot stays explicitly legacy instead of inventing one', () => {
  const normalized = normalizeSchedule({
    id: 'legacy',
    time: '10:00',
    title: 'Current visible plan',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    actualTitle: 'Recorded activity',
    actualCategory: '仕事',
    actualDuration: 55,
    actualStress: 35,
    mood: MOOD.GOOD,
  });
  assert.equal(normalized.plannedSnapshot, null);
  assert.equal(recordedPlanForSchedule(normalized).time, '10:00');
});

test('invalid planned snapshots are discarded rather than partially repaired from the current plan', () => {
  const normalized = normalizeSchedule({
    id: 'bad-snapshot',
    time: '10:00',
    title: 'Current',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: { time: '99:99', title: 'Old', category: '仕事', duration: 60, plannedStress: 40 },
    actualDuration: 60,
  });
  assert.equal(normalized.plannedSnapshot, null);
});

test('copying a recorded schedule creates a fresh pending plan without historical planned snapshot', () => {
  const copied = createPendingScheduleCopy({
    id: 'old',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: { time: '08:30', title: 'Old work', category: '仕事', duration: 90, plannedStress: 70 },
    actualTitle: 'Old work',
    actualCategory: '仕事',
    actualDuration: 80,
  }, 'fresh');
  assert.equal(copied.status, STATUS.PENDING);
  assert.equal(copied.plannedSnapshot, null);
  assert.equal(copied.id, 'fresh');
});
