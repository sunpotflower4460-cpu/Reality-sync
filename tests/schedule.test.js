import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats, formatTime, timeToHours } from '../src/utils/schedule.js';
import { STATUS } from '../src/constants.js';

test('timeToHours converts HH:mm without a redundant timeValue field', () => {
  assert.equal(timeToHours('07:30'), 7.5);
  assert.equal(timeToHours('21:00'), 21);
});

test('skipped schedules do not fabricate actual rest duration', () => {
  const stats = calculateStats([{ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 120, plannedStress: 70, status: STATUS.SKIPPED, actualDuration: 0 }]);
  assert.equal(stats.categories['仕事'].ideal, 120);
  assert.equal(stats.categories['仕事'].actual, 0);
  assert.equal(stats.categories['休息・スキップ'], undefined);
});

test('changed schedules use the recorded actual category and duration', () => {
  const stats = calculateStats([{ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 120, plannedStress: 70, status: STATUS.CHANGED, actualCategory: '趣味', actualDuration: 45 }]);
  assert.equal(stats.categories['仕事'].ideal, 120);
  assert.equal(stats.categories['仕事'].actual, 0);
  assert.equal(stats.categories['趣味'].actual, 45);
});

test('formatTime formats minute durations for analytics', () => {
  assert.equal(formatTime(0), '0分');
  assert.equal(formatTime(45), '45m');
  assert.equal(formatTime(120), '2h');
  assert.equal(formatTime(135), '2h15m');
});
