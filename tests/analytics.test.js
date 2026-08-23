import test from 'node:test';
import assert from 'node:assert/strict';
import { MOOD, STATUS } from '../src/constants.js';
import {
  calculateMonthlyInsights,
  calculateWeeklyInsights,
  exactStartDeltaMinutes,
  startTimeDeltaMinutes,
} from '../src/utils/analytics.js';

function schedule(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36),
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    status: STATUS.PENDING,
    ...overrides,
  };
}

test('legacy clock-only delta stays conservative while exact date-aware delta handles midnight', () => {
  assert.equal(startTimeDeltaMinutes('09:00', '09:15'), 15);
  assert.equal(startTimeDeltaMinutes('09:00', '08:45'), -15);
  assert.equal(startTimeDeltaMinutes('23:50', '00:10'), null);

  assert.equal(exactStartDeltaMinutes('2026-08-21', '23:50', '2026-08-22', '00:10'), 20);
  assert.equal(exactStartDeltaMinutes('2026-08-22', '00:10', '2026-08-21', '23:50'), -20);
  assert.equal(exactStartDeltaMinutes('2026-08-21', '09:00', '2026-08-22', '09:00'), 1440);
  assert.equal(exactStartDeltaMinutes('bad-date', '09:00', '2026-08-22', '09:00'), null);
});

test('weekly insights use exact start dates and never invent dates for legacy records', () => {
  const days = {
    '2026-08-17': [
      schedule({
        id: 'work',
        status: STATUS.AS_PLANNED,
        actualTitle: 'Work',
        actualCategory: '仕事',
        actualDuration: 60,
        actualStartTime: '09:15',
        actualStartDateKey: '2026-08-17',
        actualStress: 55,
        mood: MOOD.GOOD,
      }),
      schedule({
        id: 'changed',
        time: '18:00',
        title: 'Run',
        category: '運動',
        duration: 30,
        plannedStress: 60,
        status: STATUS.CHANGED,
        actualTitle: 'Walk',
        actualCategory: '運動',
        actualDuration: 20,
        actualStartTime: '18:30',
        actualStartDateKey: '2026-08-17',
        actualStress: 40,
        mood: MOOD.NORMAL,
        deviationReason: '雨',
      }),
    ],
    '2026-08-18': [
      schedule({
        id: 'skipped',
        time: '07:00',
        title: 'Exercise',
        category: '運動',
        duration: 30,
        plannedStress: 50,
        status: STATUS.SKIPPED,
        actualTitle: 'スキップ',
        actualDuration: 0,
        actualStress: 80,
        mood: MOOD.BAD,
        deviationReason: '体調不良',
      }),
    ],
    '2026-08-19': [schedule({ id: 'pending', time: '12:00', duration: 45 })],
    '2026-08-20': [
      schedule({
        id: 'untimed',
        time: '10:00',
        duration: 20,
        status: STATUS.AS_PLANNED,
        actualTitle: 'Work',
        actualCategory: '仕事',
        actualDuration: 20,
        actualStartTime: null,
        actualStress: 20,
        mood: MOOD.GOOD,
      }),
    ],
    '2026-08-21': [
      schedule({
        id: 'midnight',
        time: '23:50',
        title: 'Read',
        category: '趣味',
        duration: 10,
        plannedStress: 10,
        status: STATUS.AS_PLANNED,
        actualTitle: 'Read',
        actualCategory: '趣味',
        actualDuration: 10,
        actualStartTime: '00:10',
        actualStartDateKey: '2026-08-22',
        actualStress: 70,
        mood: MOOD.GOOD,
      }),
    ],
    '2026-08-22': [
      schedule({
        id: 'legacy-clock-only',
        time: '10:00',
        duration: 60,
        status: STATUS.AS_PLANNED,
        actualTitle: 'Work',
        actualCategory: '仕事',
        actualDuration: 60,
        actualStartTime: '10:10',
        actualStress: 30,
        mood: MOOD.NORMAL,
      }),
    ],
  };

  const insights = calculateWeeklyInsights(days, '2026-08-23');

  assert.deepEqual(insights.dateKeys, [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23',
  ]);
  assert.equal(insights.totalSchedules, 7);
  assert.equal(insights.recordedCount, 6);
  assert.equal(insights.completed, 4);
  assert.equal(insights.changed, 1);
  assert.equal(insights.skipped, 1);
  assert.equal(insights.pending, 1);
  assert.equal(insights.recordingRate, 86);
  assert.equal(insights.asPlannedRate, 67);
  assert.equal(insights.daysWithPlans, 6);
  assert.equal(insights.daysWithRecords, 5);

  assert.equal(insights.startSampleCount, 3);
  assert.equal(insights.averageStartDelta, 22);
  assert.equal(insights.averageAbsoluteStartDelta, 22);
  assert.equal(insights.untimedStartCount, 1);
  assert.equal(insights.undatedStartCount, 1);

  assert.deepEqual(insights.reasons, [
    { reason: '体調不良', count: 1 },
    { reason: '雨', count: 1 },
  ].sort((a, b) => a.reason.localeCompare(b.reason, 'ja')));

  assert.equal(insights.moodCounts[MOOD.GOOD], 3);
  assert.equal(insights.moodCounts[MOOD.NORMAL], 2);
  assert.equal(insights.moodCounts[MOOD.BAD], 1);
  assert.equal(insights.stressByStatus[STATUS.AS_PLANNED].average, 44);
  assert.equal(insights.stressByStatus[STATUS.CHANGED].average, 40);
  assert.equal(insights.stressByStatus[STATUS.SKIPPED].average, 80);

  assert.equal(insights.categories['仕事'].ideal, 185);
  assert.equal(insights.categories['仕事'].actual, 140);
  assert.equal(insights.categories['運動'].ideal, 60);
  assert.equal(insights.categories['運動'].actual, 20);
  assert.equal(insights.categories['趣味'].ideal, 10);
  assert.equal(insights.categories['趣味'].actual, 10);

  const monday = insights.daily[0];
  assert.equal(monday.total, 2);
  assert.equal(monday.recorded, 2);
  assert.equal(monday.recordingRate, 100);
  assert.equal(monday.averageStartDelta, 23);
  assert.equal(monday.startSampleCount, 2);
});

test('monthly insights aggregate multiple weeks and weekday observations descriptively', () => {
  const days = {
    '2026-08-03': [schedule({
      id: 'monday-1',
      status: STATUS.AS_PLANNED,
      actualTitle: 'Work',
      actualCategory: '仕事',
      actualDuration: 60,
      actualStartTime: '09:10',
      actualStartDateKey: '2026-08-03',
      actualStress: 40,
      mood: MOOD.GOOD,
    })],
    '2026-08-10': [schedule({
      id: 'monday-2',
      status: STATUS.CHANGED,
      actualTitle: 'Meeting',
      actualCategory: '仕事',
      actualDuration: 30,
      actualStartTime: '09:30',
      actualStartDateKey: '2026-08-10',
      actualStress: 60,
      mood: MOOD.NORMAL,
      deviationReason: '会議',
    })],
    '2026-08-11': [schedule({
      id: 'tuesday-midnight',
      time: '23:50',
      duration: 30,
      status: STATUS.AS_PLANNED,
      actualTitle: 'Work',
      actualCategory: '仕事',
      actualDuration: 30,
      actualStartTime: '00:10',
      actualStartDateKey: '2026-08-12',
      actualStress: 30,
      mood: MOOD.GOOD,
    })],
    '2026-08-31': [schedule({
      id: 'monday-3',
      status: STATUS.SKIPPED,
      actualTitle: 'スキップ',
      actualDuration: 0,
      actualStress: 70,
      mood: MOOD.BAD,
      deviationReason: '体調不良',
    })],
  };

  const insights = calculateMonthlyInsights(days, '2026-08-23');
  assert.equal(insights.dateKeys.length, 31);
  assert.equal(insights.dateKeys[0], '2026-08-01');
  assert.equal(insights.dateKeys.at(-1), '2026-08-31');
  assert.equal(insights.totalSchedules, 4);
  assert.equal(insights.recordedCount, 4);
  assert.equal(insights.recordingRate, 100);
  assert.equal(insights.asPlannedRate, 50);
  assert.equal(insights.startSampleCount, 3);
  assert.equal(insights.averageStartDelta, 20);
  assert.equal(insights.weeks.length, 6);

  const monday = insights.weekdays[0];
  assert.equal(monday.label, '月');
  assert.equal(monday.calendarDays, 5);
  assert.equal(monday.daysWithPlans, 3);
  assert.equal(monday.total, 3);
  assert.equal(monday.recorded, 3);
  assert.equal(monday.asPlannedRate, 33);
  assert.equal(monday.plannedMinutes, 180);
  assert.equal(monday.actualMinutes, 90);
  assert.equal(monday.startSampleCount, 2);
  assert.equal(monday.averageStartDelta, 20);

  const tuesday = insights.weekdays[1];
  assert.equal(tuesday.calendarDays, 4);
  assert.equal(tuesday.daysWithPlans, 1);
  assert.equal(tuesday.startSampleCount, 1);
  assert.equal(tuesday.averageStartDelta, 20);

  assert.deepEqual(insights.reasons, [
    { reason: '会議', count: 1 },
    { reason: '体調不良', count: 1 },
  ].sort((a, b) => a.reason.localeCompare(b.reason, 'ja')));
});

test('weekly and monthly insights return stable empty structures', () => {
  const week = calculateWeeklyInsights({}, '2026-08-23');
  const month = calculateMonthlyInsights({}, '2026-08-23');
  assert.equal(week.totalSchedules, 0);
  assert.equal(week.averageStartDelta, null);
  assert.equal(week.daily.length, 7);
  assert.equal(month.totalSchedules, 0);
  assert.equal(month.daily.length, 31);
  assert.equal(month.weekdays.length, 7);
  assert.equal(month.weeks.length, 6);
});
