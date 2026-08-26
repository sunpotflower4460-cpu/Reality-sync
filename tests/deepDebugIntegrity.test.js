import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_STORAGE_VERSION } from '../src/constants.js';
import { normalizeContextRule } from '../src/utils/contextRule.js';
import { normalizeExperiment } from '../src/utils/experiment.js';
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

test('missing numeric experiment condition values stay invalid instead of becoming zero', () => {
  assert.equal(normalizeExperiment(rawExperiment({ condition: { kind: 'weekday', value: null } })), null);
  assert.equal(normalizeExperiment(rawExperiment({ condition: { kind: 'planned-stress-min', value: null } })), null);
});

test('missing context-rule numeric values stay invalid instead of becoming zero', () => {
  assert.equal(normalizeContextRule({
    metric: 'target-planned-stress',
    operator: 'gte',
    threshold: null,
    sourceCandidateId: 'target-planned-stress',
    sourcePreviousValue: 40,
    sourceRecentValue: 70,
    sourceThroughDateKey: '2026-08-10',
  }), null);
  assert.equal(normalizeContextRule({
    metric: 'target-planned-stress',
    operator: 'gte',
    threshold: 55,
    sourceCandidateId: 'target-planned-stress',
    sourcePreviousValue: null,
    sourceRecentValue: 70,
    sourceThroughDateKey: '2026-08-10',
  }), null);
});

test('trial observedValue null remains unknown after experiment normalization', () => {
  const experiment = normalizeExperiment(rawExperiment({
    trials: [{
      id: 'trial-1',
      recordKey: '2026-08-24::a',
      dateKey: '2026-08-24',
      scheduleId: 'a',
      planTitle: 'Work',
      outcome: 'success',
      observedValue: null,
      observedLabel: '予定通り',
    }],
  }));
  assert.equal(experiment.trials[0].observedValue, null);
});

test('future experiment storage versions block persistence', () => {
  const result = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION + 1,
    experiments: [rawExperiment()],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedVersion, EXPERIMENT_STORAGE_VERSION + 1);
  assert.deepEqual(result.experiments, []);
});

test('experiment persistence blocks malformed trials instead of silently dropping them', () => {
  const result = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [rawExperiment({
      trials: [
        { recordKey: '2026-08-24::a', dateKey: '2026-08-24', scheduleId: 'a', planTitle: 'Work', outcome: 'success' },
        { recordKey: '', dateKey: '2026-08-24', scheduleId: 'b', planTitle: 'Work', outcome: 'failure' },
      ],
    })],
  }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.experiments, []);
});

test('experiment persistence blocks duplicate trial keys instead of silently deduplicating history', () => {
  const duplicate = { recordKey: '2026-08-24::a', dateKey: '2026-08-24', scheduleId: 'a', planTitle: 'Work', outcome: 'success' };
  const result = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [rawExperiment({ trials: [duplicate, { ...duplicate, outcome: 'failure' }] })],
  }));
  assert.equal(result.ok, false);
});

test('experiment persistence blocks malformed explicit structured metadata', () => {
  const badAdjustment = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [rawExperiment({ planAdjustment: { kind: 'buffer-before', minutes: 2 } })],
  }));
  assert.equal(badAdjustment.ok, false);

  const badObservedValue = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [rawExperiment({ trials: [{
      recordKey: '2026-08-24::a', dateKey: '2026-08-24', scheduleId: 'a', planTitle: 'Work', outcome: 'success', observedValue: 'not-a-number',
    }] })],
  }));
  assert.equal(badObservedValue.ok, false);
});

test('valid experiment storage remains writable', () => {
  const result = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [rawExperiment()],
  }));
  assert.equal(result.ok, true);
  assert.equal(result.experiments.length, 1);
  assert.equal(result.experiments[0].condition.value, 0);
});
