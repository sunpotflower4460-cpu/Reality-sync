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

function adoptedRoot(overrides = {}) {
  return experiment({
    id: 'root',
    learningRootId: 'root',
    learningVersion: 1,
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-09-01',
    ...overrides,
  });
}

function revalidationChild(overrides = {}) {
  return experiment({
    id: 'child',
    learningRootId: 'root',
    parentExperimentId: 'root',
    learningVersion: 2,
    startDateKey: '2026-09-11',
    baselineFailureRate: 0.25,
    baselineSampleCount: 8,
    sourceRetention: {
      experimentId: 'root',
      throughDateKey: '2026-09-10',
      assessmentCount: 8,
      weekCount: 3,
      failureRate: 0.25,
      experimentFailureRate: 0.2,
      differenceFromExperimentPoints: 5,
      capturedAt: '2026-09-10T10:00:00Z',
    },
    ...overrides,
  });
}

function parseMany(experiments) {
  return parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments,
  }));
}

function parse(value) {
  return parseMany([value]);
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

test('orphaned and root-mismatched learning versions are protected during normal storage load', () => {
  const orphan = revalidationChild({ parentExperimentId: 'missing-parent' });
  assert.equal(parse(orphan).ok, false);

  const root = adoptedRoot();
  const wrongRootChild = revalidationChild({ learningRootId: 'other-root' });
  assert.equal(parseMany([root, wrongRootChild]).ok, false);
});

test('learning lineage rejects duplicate or non-increasing versions', () => {
  const root = adoptedRoot();
  const child = revalidationChild();
  const duplicateVersion = revalidationChild({ id: 'sibling' });
  const reversedVersion = revalidationChild({ id: 'reversed', parentExperimentId: 'child', learningVersion: 1 });
  assert.equal(parseMany([root, child, duplicateVersion]).ok, false);
  assert.equal(parseMany([root, child, reversedVersion]).ok, false);
});

test('revalidation lineage provenance must match an adopted parent and its retention snapshot', () => {
  const root = adoptedRoot();
  assert.equal(parseMany([root, revalidationChild({
    sourceRetention: { ...revalidationChild().sourceRetention, experimentId: 'some-other-experiment' },
  })]).ok, false);
  assert.equal(parseMany([adoptedRoot({ decision: 'reject' }), revalidationChild()]).ok, false);
  assert.equal(parseMany([root, revalidationChild({
    sourceRetention: { ...revalidationChild().sourceRetention, throughDateKey: '2026-08-31' },
  })]).ok, false);
  assert.equal(parseMany([root, revalidationChild({ startDateKey: '2026-09-10' })]).ok, false);
  assert.equal(parseMany([root, revalidationChild({ baselineFailureRate: 0.5 })]).ok, false);
  assert.equal(parseMany([root, revalidationChild({ baselineSampleCount: 9 })]).ok, false);
});

test('root learning versions cannot claim a revalidation source snapshot', () => {
  const retention = revalidationChild().sourceRetention;
  assert.equal(parse(adoptedRoot({ sourceRetention: retention })).ok, false);
});

test('valid explicit experiment metadata and realistic revalidation lineage remain writable', () => {
  const root = adoptedRoot({
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
  });
  const child = revalidationChild();
  const result = parseMany([root, child]);
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].trials[0].id, 'trial-1');
  assert.equal(result.experiments[1].parentExperimentId, 'root');
  assert.equal(result.experiments[1].sourceRetention.experimentId, 'root');
});
