import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import {
  calculateRetentionSummary,
  listRetentionUsages,
  RETENTION_SIGNAL,
} from '../src/utils/retention.js';

function adoptedExperiment(id = 'exp-1', overrides = {}) {
  return {
    id,
    candidateId: `candidate-${id}`,
    candidateType: 'category-outcome',
    title: '仕事の小実験',
    hypothesis: '余白で変更が減るかもしれない',
    action: '仕事前に15分の余白を置く',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' },
    startDateKey: '2026-07-01',
    targetRuns: 4,
    baselineFailureRate: 0.6,
    baselineSampleCount: 20,
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-07-20',
    trials: [
      trial('t1', 'success'),
      trial('t2', 'success'),
      trial('t3', 'success'),
      trial('t4', 'failure'),
    ],
    createdAt: '2026-07-01T00:00:00Z',
    completedAt: '2026-07-20T00:00:00Z',
    ...overrides,
  };
}

function trial(id, outcome) {
  return {
    id,
    recordKey: `2026-07-1${id.at(-1)}::${id}`,
    dateKey: `2026-07-1${id.at(-1)}`,
    scheduleId: id,
    planTitle: 'Work',
    outcome,
    observedValue: outcome === 'failure' ? 1 : 0,
    observedLabel: outcome === 'failure' ? '変更・スキップ' : '予定通り',
    capturedAt: '2026-07-20T00:00:00Z',
  };
}

function recorded(id, status, applied = true, category = '仕事', title = 'Work', duration = 60) {
  return {
    id,
    time: '09:00',
    title,
    category,
    duration,
    plannedStress: 50,
    appliedExperimentIds: applied ? ['exp-1'] : [],
    status,
    plannedSnapshot: { time: '09:00', title, category, duration, plannedStress: 50 },
    actualTitle: status === STATUS.SKIPPED ? 'スキップ' : title,
    actualCategory: category,
    actualDuration: status === STATUS.SKIPPED ? 0 : duration,
    actualStartTime: status === STATUS.SKIPPED ? null : '09:00',
    actualStartDateKey: status === STATUS.SKIPPED ? null : '2026-08-01',
    deviationReason: status === STATUS.CHANGED || status === STATUS.SKIPPED ? '予定変更' : null,
    mood: 'normal',
    actualStress: 50,
  };
}

function makeDays(outcomes) {
  const dates = ['2026-07-21','2026-07-24','2026-07-28','2026-07-31','2026-08-04','2026-08-07','2026-08-11','2026-08-14','2026-08-18','2026-08-21'];
  return Object.fromEntries(dates.slice(0, outcomes.length).map((dateKey, index) => [
    dateKey,
    [recorded(`r${index + 1}`, outcomes[index] === 'failure' ? STATUS.CHANGED : STATUS.AS_PLANNED)],
  ]));
}

test('retention ignores matching records that were never marked as using the adopted learning', () => {
  const experiment = adoptedExperiment();
  const days = {
    '2026-07-21': [recorded('marked', STATUS.AS_PLANNED, true), recorded('unmarked', STATUS.CHANGED, false)],
  };
  const usages = listRetentionUsages(experiment, days, '2026-08-24');
  assert.equal(usages.length, 1);
  assert.equal(usages[0].scheduleId, 'marked');
});

test('generated buffer records are not double-counted as the experiment target', () => {
  const experiment = adoptedExperiment('exp-1', { condition: { kind: 'weekday', value: 0 } });
  const target = recorded('target', STATUS.AS_PLANNED, true, '仕事', 'Work', 60);
  const buffer = recorded('buffer', STATUS.AS_PLANNED, true, '休憩', '調整バッファ', 15);
  const days = { '2026-07-27': [target, buffer] };
  const usages = listRetentionUsages(experiment, days, '2026-08-24');
  assert.equal(usages.length, 1);
  assert.equal(usages[0].scheduleId, 'target');
});

test('retention stays collecting until enough normal-use observations span enough weeks', () => {
  const summary = calculateRetentionSummary(adoptedExperiment(), makeDays(['success','success','failure','success','success','success','success']), '2026-08-24');
  assert.equal(summary.assessmentCount, 7);
  assert.equal(summary.signal, RETENTION_SIGNAL.COLLECTING);
  assert.equal(summary.reviewCandidate, false);
});

test('normal operation close to experiment performance is surfaced as maintained, not proven causal', () => {
  const outcomes = ['success','success','success','failure','success','success','success','failure'];
  const summary = calculateRetentionSummary(adoptedExperiment(), makeDays(outcomes), '2026-08-24');
  assert.equal(summary.assessmentCount, 8);
  assert.ok(summary.weekCount >= 3);
  assert.equal(summary.failureRate, 0.25);
  assert.equal(summary.experimentFailureRate, 0.25);
  assert.equal(summary.signal, RETENTION_SIGNAL.MAINTAINED);
  assert.equal(summary.reviewCandidate, false);
  assert.ok(summary.interval.low <= summary.failureRate && summary.interval.high >= summary.failureRate);
});

test('a 15pt or larger deterioration after adoption becomes a review candidate without auto-rejecting the experiment', () => {
  const outcomes = ['failure','failure','failure','failure','success','success','success','success'];
  const summary = calculateRetentionSummary(adoptedExperiment(), makeDays(outcomes), '2026-08-24');
  assert.equal(summary.failureRate, 0.5);
  assert.equal(summary.differenceFromExperimentPoints, 25);
  assert.equal(summary.signal, RETENTION_SIGNAL.REVIEW);
  assert.equal(summary.reviewCandidate, true);
});

test('legacy adopted experiments without a trustworthy decision date are not assigned a synthetic retention window', () => {
  const summary = calculateRetentionSummary(adoptedExperiment('exp-1', { decisionDateKey: null }), makeDays(['success','success','success','success','success','success','success','success']), '2026-08-24');
  assert.equal(summary.signal, RETENTION_SIGNAL.UNAVAILABLE);
  assert.equal(summary.totalUsageCount, 0);
  assert.match(summary.reason, /採用日が不明/);
});
