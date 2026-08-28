import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS } from '../src/constants.js';
import { calculateMonthlyInsights, calculateWeeklyInsights } from '../src/utils/analytics.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function plan(id, status = STATUS.PENDING) {
  return {
    id,
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status,
    plannedSnapshot: status === STATUS.PENDING ? null : {
      time: '09:00',
      title: 'Work',
      category: '仕事',
      duration: 60,
      plannedStress: 40,
    },
    actualTitle: status === STATUS.PENDING ? '' : 'Work',
    actualCategory: status === STATUS.PENDING ? null : '仕事',
    actualDuration: status === STATUS.PENDING ? null : 60,
    actualStartTime: status === STATUS.PENDING ? null : '09:00',
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };
}

test('current-week analytics do not count future pending plans as missing reality', () => {
  const days = {
    '2026-08-27': [plan('past', STATUS.AS_PLANNED)],
    '2026-08-28': [plan('today', STATUS.AS_PLANNED)],
    '2026-08-29': [plan('future')],
    '2026-08-30': [plan('future-2')],
  };

  const observed = calculateWeeklyInsights(days, '2026-08-28', '2026-08-28');
  assert.deepEqual(observed.dateKeys, ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']);
  assert.equal(observed.totalSchedules, 2);
  assert.equal(observed.recordedCount, 2);
  assert.equal(observed.pending, 0);
  assert.equal(observed.recordingRate, 100);
});

test('current-day analytics do not count later-today pending plans before their scheduled time', () => {
  const alreadyDue = { ...plan('morning-pending'), time: '09:00' };
  const recordedFutureSlot = { ...plan('recorded-early', STATUS.AS_PLANNED), time: '18:00', plannedSnapshot: { ...plan('snapshot').plannedSnapshot, time: '18:00' } };
  const laterToday = { ...plan('evening-pending'), time: '18:30' };
  const days = {
    '2026-08-28': [alreadyDue, recordedFutureSlot, laterToday],
  };

  const weekly = calculateWeeklyInsights(days, '2026-08-28', '2026-08-28', '12:00');
  const monthly = calculateMonthlyInsights(days, '2026-08-28', '2026-08-28', '12:00');

  for (const observed of [weekly, monthly]) {
    assert.equal(observed.totalSchedules, 2);
    assert.equal(observed.recordedCount, 1);
    assert.equal(observed.pending, 1);
    assert.equal(observed.recordingRate, 50);
    assert.equal(observed.plannedMinutes, 120);
  }
});

test('current-month analytics stop at the observation date instead of pre-judging future plans', () => {
  const days = {
    '2026-08-28': [plan('today', STATUS.AS_PLANNED)],
    '2026-08-29': [plan('future')],
    '2026-08-31': [plan('future-2')],
  };

  const observed = calculateMonthlyInsights(days, '2026-08-28', '2026-08-28');
  assert.equal(observed.dateKeys.at(-1), '2026-08-28');
  assert.equal(observed.totalSchedules, 1);
  assert.equal(observed.recordedCount, 1);
  assert.equal(observed.pending, 0);
  assert.equal(observed.recordingRate, 100);
  assert.equal(observed.weekdays.reduce((sum, weekday) => sum + weekday.calendarDays, 0), 28);
});

test('analytics keep full historical windows when no observation cutoff is supplied', () => {
  const days = {
    '2026-08-28': [plan('recorded', STATUS.AS_PLANNED)],
    '2026-08-29': [plan('pending')],
  };
  const historical = calculateWeeklyInsights(days, '2026-08-28');
  assert.equal(historical.dateKeys.length, 7);
  assert.equal(historical.totalSchedules, 2);
  assert.equal(historical.pending, 1);
  assert.equal(historical.recordingRate, 50);
});

test('app passes the current local clock into week and month observation windows', () => {
  const app = source('src/App.jsx');
  assert.match(app, /const observationNow = new Date\(\)/);
  assert.match(app, /const observationTime = timeKeyFromDate\(observationNow\)/);
  assert.match(app, /calculateWeeklyInsights\(store\.days, selectedDate, todayKey, observationTime\)/);
  assert.match(app, /calculateMonthlyInsights\(store\.days, selectedDate, todayKey, observationTime\)/);
});

test('future daily analytics describe plans as unobserved rather than missing reality', () => {
  const analyticsView = source('src/components/AnalyticsView.jsx');
  assert.match(analyticsView, /const isFutureDate = selectedDate > dateKeyFromDate\(\)/);
  assert.match(analyticsView, /DailyAnalyticsContent stats=\{stats\} isFutureDate=\{isFutureDate\}/);
  assert.match(analyticsView, /この日の現実はまだ観測前です/);
  assert.match(analyticsView, /未来日の予定は「未記録」として数えません/);
});
