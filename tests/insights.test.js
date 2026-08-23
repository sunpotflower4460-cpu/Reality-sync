import test from 'node:test';
import assert from 'node:assert/strict';
import { MOOD, STATUS } from '../src/constants.js';
import { calculateLongitudinalInsights, wilsonInterval } from '../src/utils/insights.js';

function plannedSnapshot({ time = '09:00', category = '仕事', stress = 40 } = {}) {
  return { time, title: 'Plan', category, duration: 60, plannedStress: stress };
}

function record({
  id,
  status = STATUS.AS_PLANNED,
  time = '09:00',
  category = '仕事',
  stress = 40,
  snapshot = true,
  actualTime = null,
  actualDate = null,
  reason = null,
}) {
  return {
    id,
    time,
    title: 'Current plan',
    category,
    duration: 60,
    plannedStress: stress,
    status,
    plannedSnapshot: snapshot ? plannedSnapshot({ time, category, stress }) : null,
    actualTitle: status === STATUS.SKIPPED ? 'スキップ' : status === STATUS.CHANGED ? 'Changed activity' : 'Plan',
    actualCategory: status === STATUS.SKIPPED ? null : status === STATUS.CHANGED ? '休憩' : category,
    actualDuration: status === STATUS.SKIPPED ? 0 : 60,
    actualStartTime: status === STATUS.SKIPPED ? null : actualTime,
    actualStartDateKey: status === STATUS.SKIPPED ? null : actualDate,
    deviationReason: reason,
    actualStress: 50,
    mood: MOOD.NORMAL,
  };
}

function add(store, dateKey, schedule) {
  if (!store[dateKey]) store[dateKey] = [];
  store[dateKey].push(schedule);
}

test('Wilson interval stays bounded and contains the observed proportion', () => {
  const interval = wilsonInterval(5, 10);
  assert.ok(interval.low > 0 && interval.low < 0.5);
  assert.ok(interval.high > 0.5 && interval.high < 1);
  assert.equal(wilsonInterval(0, 0), null);
});

test('small or weak differences are not promoted into insight candidates', () => {
  const days = {
    '2026-08-03': [record({ id: 'a' })],
    '2026-08-10': [record({ id: 'b', status: STATUS.CHANGED })],
    '2026-08-17': [record({ id: 'c' })],
  };
  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  assert.equal(insights.readiness.recordedCount, 3);
  assert.equal(insights.readiness.stage, 'starting');
  assert.deepEqual(insights.candidates, []);
});

test('repeated weekday outcome differences become candidates with explicit comparison evidence', () => {
  const days = {};
  const mondays = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-07-06', '2026-07-13', '2026-08-03', '2026-08-10'];
  mondays.forEach((dateKey, index) => add(days, dateKey, record({ id: `m-${index}`, status: index < 6 ? STATUS.CHANGED : STATUS.AS_PLANNED })));

  const comparisonDates = [
    '2026-06-02', '2026-06-03', '2026-06-09', '2026-06-10', '2026-06-16', '2026-06-17', '2026-06-23', '2026-06-24',
    '2026-07-07', '2026-07-08', '2026-07-14', '2026-07-15', '2026-08-04', '2026-08-05', '2026-08-11', '2026-08-12',
  ];
  comparisonDates.forEach((dateKey, index) => add(days, dateKey, record({ id: `o-${index}`, status: index < 2 ? STATUS.CHANGED : STATUS.AS_PLANNED })));

  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  const candidate = insights.candidates.find((item) => item.id === 'weekday-outcome-0');
  assert.ok(candidate);
  assert.equal(candidate.evidence, 'repeated');
  assert.equal(candidate.sampleCount, 8);
  assert.equal(candidate.comparisonCount, 16);
  assert.ok(candidate.effectPoints >= 50);
  assert.match(candidate.comparison, /95% Wilson区間/);
});

test('planned-stress candidates use only records with an explicit original-plan snapshot', () => {
  const days = {};
  const dates = [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06',
    '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14',
  ];
  dates.forEach((dateKey, index) => add(days, dateKey, record({
    id: `s-${index}`,
    status: index < 6 ? STATUS.CHANGED : STATUS.AS_PLANNED,
    stress: index < 6 ? 80 : 40,
  })));

  for (let index = 0; index < 20; index += 1) {
    add(days, `2026-06-${String(index + 1).padStart(2, '0')}`, record({
      id: `legacy-${index}`,
      status: STATUS.CHANGED,
      stress: 95,
      snapshot: false,
    }));
  }

  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  const candidate = insights.candidates.find((item) => item.id === 'planned-stress-outcome');
  assert.ok(candidate);
  assert.equal(candidate.sampleCount, 6);
  assert.equal(candidate.comparisonCount, 8);
  assert.equal(insights.readiness.snapshotCount, 14);
  assert.equal(insights.readiness.recordedCount, 34);
});

test('exact timing candidates require an original-plan snapshot and exact actual start date/time', () => {
  const days = {};
  const mondays = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-07-06', '2026-07-13', '2026-08-03'];
  mondays.forEach((dateKey, index) => add(days, dateKey, record({ id: `late-${index}`, actualTime: '09:30', actualDate: dateKey })));
  const others = ['2026-06-02', '2026-06-03', '2026-06-09', '2026-06-10', '2026-07-07', '2026-07-08', '2026-07-14', '2026-07-15', '2026-08-04', '2026-08-05', '2026-08-11', '2026-08-12'];
  others.forEach((dateKey, index) => add(days, dateKey, record({ id: `ontime-${index}`, actualTime: '09:00', actualDate: dateKey })));
  add(days, '2026-08-17', record({ id: 'legacy-time', snapshot: false, actualTime: '10:00', actualDate: '2026-08-17' }));

  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  const candidate = insights.candidates.find((item) => item.id === 'weekday-late-0');
  assert.ok(candidate);
  assert.equal(candidate.sampleCount, 6);
  assert.equal(candidate.comparisonCount, 12);
  assert.equal(insights.readiness.exactTimingCount, 18);
});

test('repeated explicit reasons are surfaced without merging similar wording automatically', () => {
  const days = {};
  const entries = [
    ['2026-06-01', '眠気'], ['2026-06-08', '眠気'], ['2026-07-01', '眠気'], ['2026-07-08', '眠気'], ['2026-08-01', '眠気'],
    ['2026-06-10', '急用'], ['2026-07-10', '疲れ'], ['2026-08-10', 'ねむい'],
  ];
  entries.forEach(([dateKey, reason], index) => add(days, dateKey, record({ id: `r-${index}`, status: STATUS.SKIPPED, reason })));

  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  const candidate = insights.candidates.find((item) => item.id === 'reason-眠気');
  assert.ok(candidate);
  assert.equal(candidate.sampleCount, 5);
  assert.equal(candidate.monthCount, 3);
  assert.match(candidate.comparison, /似た意味の別表現は自動統合していません/);
});

test('records outside the trailing window or after the anchor date are excluded', () => {
  const days = {
    '2025-01-01': [record({ id: 'old' })],
    '2026-08-20': [record({ id: 'inside' })],
    '2026-08-25': [record({ id: 'future' })],
  };
  const insights = calculateLongitudinalInsights(days, '2026-08-24');
  assert.equal(insights.readiness.recordedCount, 1);
  assert.equal(insights.readiness.firstDate, '2026-08-20');
  assert.equal(insights.readiness.lastDate, '2026-08-20');
});
