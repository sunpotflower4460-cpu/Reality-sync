import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_STORAGE_VERSION } from '../src/constants.js';
import { parseStoredExperimentsForPersistence } from '../src/utils/experimentStorage.js';

function experiment(overrides = {}) {
  return {
    id: 'exp-1',
    candidateId: 'planned-stress-outcome',
    candidateType: 'planned-stress-outcome',
    title: 'High stress',
    hypothesis: 'Shortening may help',
    action: '15分短くする',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'planned-stress-min', value: 70 },
    startDateKey: '2026-08-28',
    targetRuns: 3,
    baselineFailureRate: 0.5,
    baselineSampleCount: 10,
    status: 'active',
    trials: [],
    ...overrides,
  };
}

function parse(value) {
  return parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [value],
  }));
}

test('experiment protocol condition cannot be rounded or type-coerced during persistence', () => {
  assert.equal(parse(experiment({ condition: { kind: 'planned-stress-min', value: 70.4 } })).ok, false);
  assert.equal(parse(experiment({ condition: { kind: 'planned-stress-min', value: '70' } })).ok, false);
  assert.equal(parse(experiment({ condition: { kind: 'weekday', value: '0' } })).ok, false);
});

test('explicit experiment metadata cannot disappear because it has the wrong type', () => {
  assert.equal(parse(experiment({ candidateId: 42 })).ok, false);
  assert.equal(parse(experiment({ candidateType: { future: true } })).ok, false);
  assert.equal(parse(experiment({ hypothesis: 99 })).ok, false);
  assert.equal(parse(experiment({ metricLabel: ['unexpected'] })).ok, false);
});

test('explicit trial identity and observation metadata cannot be silently replaced', () => {
  const baseTrial = {
    id: 'trial-1',
    recordKey: '2026-08-28::work',
    dateKey: '2026-08-28',
    scheduleId: 'work',
    planTitle: 'Work',
    outcome: 'success',
    observedValue: 0,
    observedLabel: '予定通り',
    capturedAt: '2026-08-28T10:00:00Z',
  };

  assert.equal(parse(experiment({ trials: [{ ...baseTrial, id: '' }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, observedLabel: 1 }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, outcome: 'maybe' }] })).ok, false);
});

test('valid explicit experiment metadata remains writable', () => {
  const result = parse(experiment({
    trials: [{
      id: 'trial-1',
      recordKey: '2026-08-28::work',
      dateKey: '2026-08-28',
      scheduleId: 'work',
      planTitle: 'Work',
      outcome: 'success',
      observedValue: 0,
      observedLabel: '予定通り',
      capturedAt: '2026-08-28T10:00:00Z',
    }],
  }));
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].trials[0].id, 'trial-1');
});
