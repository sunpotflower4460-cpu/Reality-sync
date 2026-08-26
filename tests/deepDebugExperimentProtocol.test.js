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
  }));
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].decision, 'adopt');
});
