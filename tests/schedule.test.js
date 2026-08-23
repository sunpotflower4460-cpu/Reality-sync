import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStats,
  createPendingScheduleCopy,
  durationAfterStatusChange,
  formatTime,
  isValidTime,
  normalizeSchedule,
  normalizeSchedules,
  parseActualDuration,
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
  const input = [{ id: 2, time: '18:00' }, { id: 1, time: '07:00' }, { id: 3, time: '12:30' }];
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

test('as-planned records keep their actual snapshot when the plan is edited later', () => {
  const normalized = normalizeSchedule({ id: 'recorded', time: '10:00', title: 'Edited plan title', category: '仕事', duration: 60, plannedStress: 40, status: STATUS.AS_PLANNED, actualTitle: 'Original recorded title', actualCategory: '運動', actualDuration: 30, actualStress: 35, mood: MOOD.GOOD });
  assert.equal(normalized.actualTitle, 'Original recorded title');
  assert.equal(normalized.actualCategory, '運動');
  const stats = calculateStats([normalized]);
  assert.equal(stats.categories['仕事'].ideal, 60);
  assert.equal(stats.categories['仕事'].actual, 0);
  assert.equal(stats.categories['運動'].actual, 30);
});

test('actual start date is preserved only when explicitly valid and paired with a start time', () => {
  const exact = normalizeSchedule({ id: 1, time: '23:50', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartTime: '00:10', actualStartDateKey: '2026-08-24' });
  const legacyTimeOnly = normalizeSchedule({ id: 2, time: '10:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartTime: '10:15' });
  const invalidDate = normalizeSchedule({ id: 3, time: '10:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartTime: '10:15', actualStartDateKey: '2026-02-30' });
  const noTime = normalizeSchedule({ id: 4, time: '10:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartDateKey: '2026-08-24' });

  assert.equal(exact.actualStartTime, '00:10');
  assert.equal(exact.actualStartDateKey, '2026-08-24');
  assert.equal(legacyTimeOnly.actualStartTime, '10:15');
  assert.equal(legacyTimeOnly.actualStartDateKey, null);
  assert.equal(invalidDate.actualStartDateKey, null);
  assert.equal(noTime.actualStartTime, null);
  assert.equal(noTime.actualStartDateKey, null);
});

test('actual start time stays unknown unless a valid time was explicitly recorded', () => {
  const valid = normalizeSchedule({ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartTime: '09:17' });
  const invalid = normalizeSchedule({ id: 2, time: '10:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.AS_PLANNED, actualDuration: 55, actualStartTime: '99:99' });
  assert.equal(valid.actualStartTime, '09:17');
  assert.equal(invalid.actualStartTime, null);
});

test('deviation reasons are only retained for changed or skipped reality', () => {
  const changed = normalizeSchedule({ id: 1, time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.CHANGED, actualTitle: 'Rest', actualCategory: '休憩', actualDuration: 20, deviationReason: '  sudden fatigue  ' });
  const skipped = normalizeSchedule({ id: 2, time: '10:00', title: 'Run', category: '運動', duration: 30, plannedStress: 40, status: STATUS.SKIPPED, deviationReason: 'rain' });
  const planned = normalizeSchedule({ id: 3, time: '11:00', title: 'Read', category: '自己啓発', duration: 30, plannedStress: 20, status: STATUS.AS_PLANNED, actualDuration: 30, deviationReason: 'should disappear' });
  assert.equal(changed.deviationReason, 'sudden fatigue');
  assert.equal(skipped.deviationReason, 'rain');
  assert.equal(skipped.actualStartTime, null);
  assert.equal(skipped.actualStartDateKey, null);
  assert.equal(planned.deviationReason, null);
});

test('pending plan copies strip all historical reality fields and receive a fresh id', () => {
  const copied = createPendingScheduleCopy({ id: 'old', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, status: STATUS.CHANGED, actualTitle: 'Nap', actualCategory: '休憩', actualDuration: 30, actualStartTime: '09:20', actualStartDateKey: '2026-08-23', deviationReason: 'tired', mood: MOOD.BAD, actualStress: 90 }, 'fresh');
  assert.equal(copied.id, 'fresh');
  assert.equal(copied.status, STATUS.PENDING);
  assert.equal(copied.title, 'Work');
  assert.equal(copied.actualTitle, '');
  assert.equal(copied.actualCategory, null);
  assert.equal(copied.actualDuration, null);
  assert.equal(copied.actualStartTime, null);
  assert.equal(copied.actualStartDateKey, null);
  assert.equal(copied.deviationReason, null);
  assert.equal(copied.mood, null);
  assert.equal(copied.actualStress, null);
});

test('normalization clamps corrupted numeric values and rejects unknown categories', () => {
  const normalized = normalizeSchedule({ id: 7, time: '27:80', title: '  Test  ', category: '__proto__', duration: 99999, plannedStress: -20, status: STATUS.AS_PLANNED, actualDuration: 99999, actualStress: 500, mood: 'unknown' });
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
  const normalized = normalizeSchedule({ id: 3, time: '12:00', title: 'Lunch', category: '休憩', duration: 60, plannedStress: 10, status: STATUS.CHANGED, actualTitle: '   ', actualCategory: '趣味', actualDuration: 30, actualStartTime: '12:10', actualStartDateKey: '2026-08-23', deviationReason: 'busy', actualStress: 80, mood: MOOD.BAD });
  assert.equal(normalized.status, STATUS.PENDING);
  assert.equal(normalized.actualTitle, '');
  assert.equal(normalized.actualCategory, null);
  assert.equal(normalized.actualDuration, null);
  assert.equal(normalized.actualStartTime, null);
  assert.equal(normalized.actualStartDateKey, null);
  assert.equal(normalized.deviationReason, null);
  assert.equal(normalized.actualStress, null);
  assert.equal(normalized.mood, null);
});

test('normalization preserves an intentional empty schedule list', () => {
  const fallback = [{ id: 1, time: '07:00', title: 'Run', category: '運動', duration: 30, plannedStress: 40, status: STATUS.PENDING }];
  assert.deepEqual(normalizeSchedules([], fallback), []);
});

test('normalization drops duplicate ids and falls back when non-empty stored entries are unusable', () => {
  const fallback = [{ id: 1, time: '07:00', title: 'Run', category: '運動', duration: 30, plannedStress: 40, status: STATUS.PENDING }];
  assert.equal(normalizeSchedules([null], fallback).length, 1);
  const duplicate = normalizeSchedules([{ ...fallback[0] }, { ...fallback[0], title: 'Duplicate' }], fallback);
  assert.equal(duplicate.length, 1);
  assert.equal(duplicate[0].title, 'Run');
});

test('unknown ids never inherit unrelated demo schedule fields by array position', () => {
  const fallback = [{ id: 1, time: '07:00', title: 'Run', category: '運動', duration: 30, plannedStress: 40, status: STATUS.PENDING }];
  const [normalized] = normalizeSchedules([{ id: 'custom', title: 'Custom' }], fallback);
  assert.equal(normalized.id, 'custom');
  assert.equal(normalized.title, 'Custom');
  assert.equal(normalized.time, '00:00');
  assert.equal(normalized.category, 'その他');
  assert.equal(normalized.duration, 0);
});

test('actual duration parser rejects blank and out-of-range input instead of silently coercing it', () => {
  assert.equal(parseActualDuration(''), null);
  assert.equal(parseActualDuration('   '), null);
  assert.equal(parseActualDuration(-1), null);
  assert.equal(parseActualDuration(1441), null);
  assert.equal(parseActualDuration('45'), 45);
  assert.equal(parseActualDuration(0), 0);
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
