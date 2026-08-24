import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { calculateContextShiftSummaries, calculateContextShiftSummary } from '../src/utils/contextShift.js';
import { shiftDateKey } from '../src/utils/date.js';
import { normalizeExperiment } from '../src/utils/experiment.js';

function adoptedExperiment(overrides = {}) {
  return normalizeExperiment({
    id: overrides.id ?? 'exp',
    learningRootId: overrides.learningRootId ?? overrides.id ?? 'exp',
    learningVersion: overrides.learningVersion ?? 1,
    parentExperimentId: overrides.parentExperimentId ?? null,
    title: overrides.title ?? 'Monday learning',
    action: '余白を置く',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'weekday', value: 0 },
    startDateKey: '2025-12-01',
    targetRuns: 4,
    baselineFailureRate: 0.5,
    baselineSampleCount: 20,
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: overrides.decisionDateKey ?? '2026-01-01',
    trials: overrides.trials ?? [0, 1, 2, 3].map((index) => ({
      recordKey: `trial-${index}`,
      dateKey: `2025-12-${String(1 + index * 7).padStart(2, '0')}`,
      scheduleId: `trial-${index}`,
      planTitle: 'Work',
      outcome: 'success',
    })),
    createdAt: '2025-11-30T00:00:00Z',
    completedAt: '2025-12-29T00:00:00Z',
  });
}

function recordedTarget(experimentId, dateKey, index, {
  failed = false,
  plannedStress = 40,
  duration = 60,
  actualStress = 35,
  mood = 'normal',
  includeActualContext = true,
} = {}) {
  const value = {
    id: `target-${index}`,
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration,
    plannedStress,
    appliedExperimentIds: [experimentId],
    status: failed ? STATUS.CHANGED : STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Work', category: '仕事', duration, plannedStress },
    actualTitle: failed ? 'Changed work' : 'Work',
    actualCategory: '仕事',
    actualDuration: duration,
    actualStartTime: '09:05',
    actualStartDateKey: dateKey,
    deviationReason: failed ? '予定変更' : null,
  };
  if (includeActualContext) {
    value.actualStress = actualStress;
    value.mood = mood;
  }
  return value;
}

function companion(dateKey, index, {
  duration = 60,
  plannedStress = 30,
  status = STATUS.AS_PLANNED,
  category = '家事',
} = {}) {
  const value = {
    id: `companion-${index}`,
    time: '13:00',
    title: 'Companion',
    category,
    duration,
    plannedStress,
    appliedExperimentIds: [],
    status,
  };
  if (status !== STATUS.PENDING) {
    value.plannedSnapshot = { time: '13:00', title: 'Companion', category, duration, plannedStress };
    value.actualTitle = 'Companion';
    value.actualCategory = category;
    value.actualDuration = duration;
    value.actualStartTime = '13:00';
    value.actualStartDateKey = dateKey;
    value.actualStress = plannedStress;
    value.mood = 'normal';
  }
  return value;
}

function buildDays(experimentId, count, configForIndex) {
  const days = {};
  for (let index = 0; index < count; index += 1) {
    const dateKey = shiftDateKey('2026-01-05', index * 7);
    const config = configForIndex(index, dateKey);
    days[dateKey] = [
      recordedTarget(experimentId, dateKey, index, config.target),
      companion(dateKey, index, config.companion),
    ];
  }
  return days;
}

function lastDate(count) {
  return shiftDateKey('2026-01-05', (count - 1) * 7);
}

test('context shift surfaces large explicit changes between an earlier stable window and recent deterioration', () => {
  const experiment = adoptedExperiment();
  const days = buildDays(experiment.id, 24, (index) => index < 12
    ? { target: { failed: false, plannedStress: 40, duration: 60, actualStress: 35, mood: 'normal' }, companion: { duration: 60, plannedStress: 30 } }
    : { target: { failed: index < 18, plannedStress: 70, duration: 90, actualStress: 60, mood: index < 20 ? 'bad' : 'normal' }, companion: { duration: 180, plannedStress: 70 } });

  const summary = calculateContextShiftSummary(experiment, days, lastDate(24));
  assert.equal(summary.available, true);
  assert.equal(summary.previousWindow.count, 12);
  assert.equal(summary.recentWindow.count, 12);
  assert.equal(summary.previousWindow.failureRate, 0);
  assert.equal(summary.recentWindow.failureRate, 0.5);
  const ids = new Set(summary.candidates.map((candidate) => candidate.id));
  assert.equal(ids.has('target-planned-stress'), true);
  assert.equal(ids.has('target-duration'), true);
  assert.equal(ids.has('actual-stress'), true);
  assert.equal(ids.has('bad-mood-rate'), true);
  assert.equal(ids.has('day-planned-minutes'), true);
  assert.equal(ids.has('day-planned-stress'), true);
});

test('context shift refuses comparison when the earlier normal-operation window is too small', () => {
  const experiment = adoptedExperiment();
  const days = buildDays(experiment.id, 18, (index) => ({
    target: { failed: index >= 12 && index < 16 },
    companion: {},
  }));
  const summary = calculateContextShiftSummary(experiment, days, lastDate(18));
  assert.equal(summary.available, false);
  assert.equal(summary.previousWindow.count, 6);
  assert.match(summary.reason, /8件以上/);
});

test('context shift refuses to call an earlier window stable when it was already degraded', () => {
  const experiment = adoptedExperiment();
  const days = buildDays(experiment.id, 24, (index) => ({
    target: { failed: (index < 12 && index < 4) || (index >= 12 && index < 18) },
    companion: {},
  }));
  const summary = calculateContextShiftSummary(experiment, days, lastDate(24));
  assert.equal(summary.available, false);
  assert.match(summary.reason, /すでに大きく悪化/);
});

test('actual stress and mood are never synthesized from normalization defaults for context shift', () => {
  const experiment = adoptedExperiment();
  const days = buildDays(experiment.id, 24, (index) => ({
    target: { failed: index >= 12 && index < 18, includeActualContext: false },
    companion: {},
  }));
  const summary = calculateContextShiftSummary(experiment, days, lastDate(24));
  assert.equal(summary.available, true);
  const ids = new Set(summary.candidates.map((candidate) => candidate.id));
  assert.equal(ids.has('actual-stress'), false);
  assert.equal(ids.has('bad-mood-rate'), false);
});

test('full-day context metrics are withheld when historical day plans are incomplete or mutable', () => {
  const experiment = adoptedExperiment();
  const days = buildDays(experiment.id, 24, (index) => ({
    target: { failed: index >= 12 && index < 18 },
    companion: { status: STATUS.PENDING, duration: index < 12 ? 30 : 300, plannedStress: index < 12 ? 10 : 90 },
  }));
  const summary = calculateContextShiftSummary(experiment, days, lastDate(24));
  assert.equal(summary.available, true);
  const ids = new Set(summary.candidates.map((candidate) => candidate.id));
  assert.equal([...ids].some((id) => id.startsWith('day-')), false);
});

test('context shift summaries only follow the current adopted version in a learning lineage', () => {
  const v1 = adoptedExperiment({ id: 'v1', learningRootId: 'root', learningVersion: 1 });
  const v2 = adoptedExperiment({ id: 'v2', learningRootId: 'root', learningVersion: 2, parentExperimentId: 'v1', decisionDateKey: lastDate(24) });
  const days = buildDays(v1.id, 24, (index) => ({
    target: { failed: index >= 12 && index < 18 },
    companion: {},
  }));
  assert.equal(calculateContextShiftSummary(v1, days, lastDate(24))?.available, true);
  assert.deepEqual(calculateContextShiftSummaries([v1, v2], days, lastDate(24)), []);
});
