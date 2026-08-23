import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKeyFromDate,
  formatDateLabel,
  formatShortDateLabel,
  formatWeekLabel,
  getWeekDateKeys,
  isToday,
  isValidDateKey,
  parseDateKey,
  shiftDateKey,
  startOfWeekDateKey,
} from '../src/utils/date.js';

test('date keys use local calendar fields', () => {
  const date = new Date(2026, 7, 23, 22, 30);
  assert.equal(dateKeyFromDate(date), '2026-08-23');
});

test('date key validation rejects impossible dates', () => {
  assert.equal(isValidDateKey('2026-02-28'), true);
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(parseDateKey('not-a-date'), null);
});

test('day navigation crosses month and year boundaries safely', () => {
  assert.equal(shiftDateKey('2026-08-31', 1), '2026-09-01');
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
});

test('Monday-based week helpers include seven local calendar days', () => {
  assert.equal(startOfWeekDateKey('2026-08-23'), '2026-08-17');
  assert.equal(startOfWeekDateKey('2026-08-17'), '2026-08-17');
  assert.deepEqual(getWeekDateKeys('2026-08-23'), [
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
    '2026-08-22',
    '2026-08-23',
  ]);
  assert.deepEqual(getWeekDateKeys('2026-01-01'), [
    '2025-12-29',
    '2025-12-30',
    '2025-12-31',
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
    '2026-01-04',
  ]);
});

test('today comparison accepts an injected clock', () => {
  const now = new Date(2026, 7, 23, 8, 0);
  assert.equal(isToday('2026-08-23', now), true);
  assert.equal(isToday('2026-08-24', now), false);
});

test('formatted date and week labels are human-readable Japanese labels', () => {
  assert.match(formatDateLabel('2026-08-23'), /8月23日/);
  assert.match(formatShortDateLabel('2026-08-23'), /8/);
  assert.match(formatWeekLabel('2026-08-23'), /8/);
  assert.match(formatWeekLabel('2026-01-01'), /2025/);
  assert.match(formatWeekLabel('2026-01-01'), /2026/);
});
