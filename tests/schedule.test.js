import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStats,
  durationAfterStatusChange,
  formatTime,
  isValidTime,
  normalizeSchedule,
  normalizeSchedules,
  replacementTitleForEditing,
  sortSchedulesByTime,
  timeToHours,
} from '../src/utils/schedule.js';
import { MOOD, STATUS } from '../src/constants.js';

test('timeToHours converts valid HH:mm and rejects invalid clock values', () => {
  assert.equal(timeToHours('07:30'), 7.5);
  assert.equal(timeToHours('21:00'), 21);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(timeToHours('99:99'), 0);
});

test('sortSchedulesByTime returns a chronological copy without mutating input', () => {
  const input = [
    { id: 2, time: '18:00' },
    { id: 1, time: '07:00' },
    { id: 3, time: '12:30' },
  ];
  const ordered = sortSchedulesByTime(input);
  assert.deepEqual(ordered.map((schedule) => schedule.id), [1, 3, 2]);
  assert.deepEqual(input.map((schedule) => schedule.id), [2, 1, 3]);
});

test('skipped schedules do not fabricate actual rest duration', () => {
  const stats = calculateStats([{ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 120, plannedStress: 70, status: STATUS.SKIPPED, actualDuration: 0 }]);
  assert.equal(stats.categories['仕事'].ideal, 120);
  assert.equal(stats.categories['仕事'].actual, 0);
  assert.equal(stats.categories['休息・スキップ'], undefined);
});

test('changed schedules use the recorded actual category and duration', () => {
  const stats = calculateStats([{ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 120, plannedStress: 70, status: STATUS.CHANGED, actualTitle: 'Read', actualCategory: '趣味', actualDuration: 45 }]);
  assert.equal(stats.categories['仕事'].ideal, 120);
  assert.equal(stats.categories['仕事'].actual, 0);
  assert.equal(stats.categories['趣味'].actual, 45);
});

test('normalization clamps corrupted numeric values and rejects unknown categories', () => {
  const normalized = normalizeSchedule({
    id: 7,
    time: '27:80',
    title: '  Test  ',
    category: '__proto__',
    duration: 99999,
    plannedStress: -20,
    status: STATUS.AS_PLANNED,
    actualDuration: 99999,
    actualStress: 500,
    mood: 'unknown',
  });

  assert.equal(normalized.time, '00:00');
  assert.equal(normalized.title, 'Test');
  assert.equal(normalized.category, 'その他');
  assert.equal(normalized.duration, 1440);
  assert.equal(normalized.plannedStress, 0);
  assert.equal(normalized.actualDuration, 1440);
  assert.equal(normalized.actualStress, 100);
  assert.equal(normalized.mood, MOOD.NORMAL);
});

test('malformed changed records return to pending instead of keeping inconsistent actual fields', () => {
  const normalized = normalizeSchedule({
    id: 3,
    time: '12:00',
    title: 'Lunch',
    category: '休憩',
    duration: 60,
    plannedStress: 10,
    status: STATUS.CHANGED,
    actualTitle: '   ',
    actualCategory: '趣味',
    actualDuration: 30,
    actualStress: 80,
    mood: MOOD.BAD,
  });

  assert.equal(normalized.status, STATUS.PENDING);
  assert.equal(normalized.actualTitle, '');
  assert.equal(normalized.actualCategory, null);
  assert.equal(normalized.actualDuration, null);
  assert.equal(normalized.actualStress, null);
  assert.equal(normalized.mood, null);
});

test('normalization drops duplicate ids and falls back when stored entries are unusable', () => {
  const fallback = [{ id: 1, time: '07:00', title: 'Run', category: '運動', duration: 30, plannedStress: 40, status: STATUS.PENDING }];
  assert.equal(normalizeSchedules([null], fallback).length, 1);

  const duplicate = normalizeSchedules([
    { ...fallback[0] },
    { ...fallback[0], title: 'Duplicate' },
  ], fallback);
  assert.equal(duplicate.length, 1);
  assert.equal(duplicate[0].title, 'Run');
});

test('changing a skipped record back to an active status restores the planned duration', () => {
  assert.equal(durationAfterStatusChange(0, STATUS.SKIPPED, STATUS.AS_PLANNED, 90), 90);
  assert.equal(durationAfterStatusChange(0, STATUS.SKIPPED, STATUS.CHANGED, 90), 90);
  assert.equal(durationAfterStatusChange(45, STATUS.CHANGED, STATUS.SKIPPED, 90), 0);
});

test('replacement title is only reused when editing an existing changed record', () => {
  assert.equal(replacementTitleForEditing({ status: STATUS.AS_PLANNED, actualTitle: 'Original title' }), '');
  assert.equal(replacementTitleForEditing({ status: STATUS.SKIPPED, actualTitle: 'スキップ' }), '');
  assert.equal(replacementTitleForEditing({ status: STATUS.CHANGED, actualTitle: '  Read a book  ' }), 'Read a book');
});

test('calculateStats keeps hostile category keys out of the aggregation object', () => {
  const stats = calculateStats([{ id: 1, time: '09:00', title: 'Work', category: '__proto__', duration: 30, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 30, actualStress: 50 }]);
  assert.equal(stats.categories['その他'].ideal, 30);
  assert.equal(Object.getPrototypeOf(stats.categories), null);
});

test('formatTime formats minute durations for analytics', () => {
  assert.equal(formatTime(0), '0分');
  assert.equal(formatTime(45), '45m');
  assert.equal(formatTime(120), '2h');
  assert.equal(formatTime(135), '2h15m');
});
