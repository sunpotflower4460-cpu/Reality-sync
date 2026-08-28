import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { calculateWeeklyInsights, exactStartDeltaMinutes } from '../src/utils/analytics.js';

function recordedSchedule(id, actualStartDateKey, actualStartTime = '09:10') {
  return {
    id,
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    appliedExperimentIds: [],
    status: STATUS.AS_PLANNED,
    plannedSnapshot: {
      time: '09:00',
      title: 'Work',
      category: '仕事',
      duration: 60,
      plannedStress: 50,
    },
    actualTitle: 'Work',
    actualCategory: '仕事',
    actualDuration: 60,
    actualStartTime,
    actualStartDateKey,
    deviationReason: null,
    mood: null,
    actualStress: 50,
  };
}

test('exact start delta accepts adjacent-day reality but rejects distant dates', () => {
  assert.equal(exactStartDeltaMinutes('2026-08-20', '23:50', '2026-08-21', '00:10'), 20);
  assert.equal(exactStartDeltaMinutes('2026-08-20', '09:00', '2026-08-21', '09:00'), 1440);
  assert.equal(exactStartDeltaMinutes('2026-08-20', '09:00', '2026-08-22', '09:00'), null);
  assert.equal(exactStartDeltaMinutes('2026-08-20', '09:00', '2026-08-18', '09:00'), null);
});

test('distant actual start dates are counted as excluded rather than distorting weekly averages', () => {
  const insights = calculateWeeklyInsights({
    '2026-08-17': [
      recordedSchedule('valid', '2026-08-17', '09:10'),
      recordedSchedule('distant', '2026-08-20', '09:00'),
    ],
  }, '2026-08-17');

  assert.equal(insights.startSampleCount, 1);
  assert.equal(insights.averageStartDelta, 10);
  assert.equal(insights.distantStartCount, 1);
  assert.equal(insights.daily[0].distantStartCount, 1);
});
