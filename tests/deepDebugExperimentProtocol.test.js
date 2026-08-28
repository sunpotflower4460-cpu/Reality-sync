import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_STORAGE_VERSION } from '../src/constants.js';
import { parseStoredExperimentsForPersistence } from '../src/utils/experimentStorage.js';

function rawExperiment(overrides = {}) {
  return {
    id: 'exp-1',
    title: 'Monday buffer',
    action: '15分余白',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-24',
    targetRuns: 3,
    baselineFailureRate: 0.5,
    baselineSampleCount: 10,
    status: 'active',
    trials: [],
    ...overrides,
  };
}

function validCompletedTrials() {
  return [
    {
      id: 'trial-1',
      recordKey: '2026-08-24::work-1',
      dateKey: '2026-08-24',
      scheduleId: 'work-1',
      planTitle: 'Work 1',
      outcome: 'success',
      observedValue: 0,
      observedLabel: '予定通り',
      capturedAt: '2026-08-24T12:00:00Z',
    },
    {
      id: 'trial-2',
      recordKey: '2026-08-25::work-2',
      dateKey: '2026-08-25',
      scheduleId: 'work-2',
      planTitle: 'Work 2',
      outcome: 'failure',
      observedValue: 1,
      observedLabel: '変更・スキップ',
      capturedAt: '2026-08-25T12:00:00Z',
    },
    {
      id: 'trial-3',
      recordKey: '2026-08-26::work-3',
      dateKey: '2026-08-26',
      scheduleId: 'work-3',
      planTitle: 'Work 3',
      outcome: 'success',
      observedValue: 0,
      observedLabel: '予定通り',
      capturedAt: '2026-08-26T12:00:00Z',
    },
  ];
}

function parse(experiment) {
  return parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [experiment],
  }));
}

test('experiment persistence refuses to invent a missing experiment id', () => {
  const experiment = rawExperiment();
  delete experiment.id;
  assert.equal(parse(experiment).ok, false);
});

test('experiment persistence rejects target-run coercion that would alter the protocol', () => {
  assert.equal(parse(rawExperiment({ targetRuns: null })).ok, false);
  assert.equal(parse(rawExperiment({ targetRuns: 99 })).ok, false);
  assert.equal(parse(rawExperiment({ targetRuns: 3.5 })).ok, false);
});

test('versioned experiment persistence rejects numeric strings instead of silently changing schema types', () => {
  assert.equal(parse(rawExperiment({ targetRuns: '3' })).ok, false);
  assert.equal(parse(rawExperiment({ baselineFailureRate: '0.5' })).ok, false);
  assert.equal(parse(rawExperiment({ baselineSampleCount: '10' })).ok, false);
  assert.equal(parse(rawExperiment({ learningVersion: '1' })).ok, false);

  const stringObservedValue = validCompletedTrials();
  stringObservedValue[0] = { ...stringObservedValue[0], observedValue: '0' };
  assert.equal(parse(rawExperiment({
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-08-30',
    completedAt: '2026-08-30T12:00:00Z',
    trials: stringObservedValue,
  })).ok, false);
});

test('known legacy bare-array experiments can canonicalize old numeric strings once', () => {
  const result = parseStoredExperimentsForPersistence(JSON.stringify([
    rawExperiment({ targetRuns: '3', baselineFailureRate: '0.5', baselineSampleCount: '10' }),
  ]));
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].targetRuns, 3);
  assert.equal(result.experiments[0].baselineFailureRate, 0.5);
  assert.equal(result.experiments[0].baselineSampleCount, 10);
});

test('experiment persistence rejects a decision that normalization would erase from an active experiment', () => {
  assert.equal(parse(rawExperiment({ status: 'active', decision: 'adopt' })).ok, false);
});

test('experiment persistence rejects missing explicit baseline sample counts instead of converting null to zero', () => {
  assert.equal(parse(rawExperiment({ baselineSampleCount: null })).ok, false);
});

test('experiment persistence preserves explicit trial and lifecycle text metadata', () => {
  const badTrialTitle = parse(rawExperiment({
    trials: [{
      recordKey: '2026-08-24::work', dateKey: '2026-08-24', scheduleId: 'work',
      planTitle: null, outcome: 'success', capturedAt: '2026-08-24T12:00:00Z',
    }],
  }));
  const badCreatedAt = parse(rawExperiment({ createdAt: 123 }));
  assert.equal(badTrialTitle.ok, false);
  assert.equal(badCreatedAt.ok, false);
});

test('valid completed experiment protocol remains writable', () => {
  const result = parse(rawExperiment({
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-08-30',
    completedAt: '2026-08-30T12:00:00Z',
    trials: validCompletedTrials(),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].decision, 'adopt');
  assert.equal(result.experiments[0].trials.length, 3);
});
