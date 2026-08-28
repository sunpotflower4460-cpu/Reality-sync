import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS } from '../src/constants.js';
import {
  getCarryoverDuePendingSchedules,
  getDuePendingSchedules,
  normalizeNotifiedReminderKeys,
  normalizeReminderPreferences,
  reminderNotificationKey,
} from '../src/utils/reminder.js';

function plan(overrides = {}) {
  return {
    id: overrides.id ?? 'plan',
    time: '10:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.PENDING,
    ...overrides,
  };
}

test('reminder preferences reject unsupported delay values and preserve explicit toggles', () => {
  assert.deepEqual(normalizeReminderPreferences({ enabled: false, delayMinutes: 999, browserNotifications: true }), {
    enabled: false,
    delayMinutes: 15,
    browserNotifications: true,
  });
});

test('due reminders only include today pending plans after the configured delay', () => {
  const now = new Date(2026, 7, 23, 10, 15, 0, 0);
  const schedules = [
    plan({ id: 'due', time: '10:00' }),
    plan({ id: 'not-yet', time: '10:01' }),
    plan({ id: 'recorded', time: '09:00', status: STATUS.SKIPPED, actualDuration: 0, actualStress: 20, mood: 'normal' }),
  ];

  const due = getDuePendingSchedules(schedules, '2026-08-23', now, { enabled: true, delayMinutes: 15, browserNotifications: false });
  assert.deepEqual(due.map((schedule) => schedule.id), ['due']);
  assert.deepEqual(getDuePendingSchedules(schedules, '2026-08-22', now, { enabled: true, delayMinutes: 15 }), []);
  assert.deepEqual(getDuePendingSchedules(schedules, '2026-08-23', now, { enabled: false, delayMinutes: 15 }), []);
});

test('a delayed late-night reminder remains eligible after midnight only when its due time crossed the day boundary', () => {
  const afterMidnight = new Date(2026, 7, 24, 1, 30, 0, 0);
  const schedules = [
    plan({ id: 'crossed', time: '23:30' }),
    plan({ id: 'not-crossed', time: '20:00' }),
    plan({ id: 'already-recorded', time: '23:20', status: STATUS.AS_PLANNED, actualTitle: 'Work' }),
  ];
  const preferences = { enabled: true, delayMinutes: 120, browserNotifications: true };

  const carryover = getCarryoverDuePendingSchedules(schedules, '2026-08-23', afterMidnight, preferences);
  assert.deepEqual(carryover.map((schedule) => schedule.id), ['crossed']);
  assert.deepEqual(getCarryoverDuePendingSchedules(schedules, '2026-08-22', afterMidnight, preferences), []);
});

test('cross-midnight reminders wait until the configured delayed time on the new day', () => {
  const schedules = [plan({ id: 'late', time: '23:30' })];
  const preferences = { enabled: true, delayMinutes: 120, browserNotifications: true };
  assert.deepEqual(
    getCarryoverDuePendingSchedules(schedules, '2026-08-23', new Date(2026, 7, 24, 1, 29), preferences),
    [],
  );
  assert.deepEqual(
    getCarryoverDuePendingSchedules(schedules, '2026-08-23', new Date(2026, 7, 24, 1, 30), preferences).map((schedule) => schedule.id),
    ['late'],
  );
});

test('browser reminder monitoring reads today and carryover plans independently when another date is displayed', () => {
  const hook = readFileSync(new URL('../src/hooks/useDueRecordReminders.js', import.meta.url), 'utf8');
  assert.match(hook, /dateKey === todayKey \? schedules : readSchedulesForDate\(todayKey\)/);
  assert.match(hook, /dateKey === previousDateKey \? schedules : readSchedulesForDate\(previousDateKey\)/);
  assert.match(hook, /parseStoredScheduleStoreResult\(window\.localStorage\.getItem\(STORAGE_KEY\)\)/);
  assert.match(hook, /getDuePendingSchedules\(todaySchedules, todayKey, now, preferences\)/);
  assert.match(hook, /getCarryoverDuePendingSchedules\(previousSchedules, previousDateKey, now, preferences\)/);
  assert.match(hook, /reminderNotificationKey\(sourceDateKey, schedule\.id\)/);
});

test('reminder notification keys are date scoped and old-day dedupe keys are discarded', () => {
  const todayKey = reminderNotificationKey('2026-08-23', 'a');
  assert.equal(todayKey, '2026-08-23:a');
  assert.deepEqual(normalizeNotifiedReminderKeys([
    '2026-08-22:a',
    '2026-08-23:a',
    '2026-08-23:a',
    '2026-08-23:b',
    42,
  ], '2026-08-23'), ['2026-08-23:a', '2026-08-23:b']);
});
