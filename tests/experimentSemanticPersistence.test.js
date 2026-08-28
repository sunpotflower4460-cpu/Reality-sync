import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_STORAGE_VERSION } from '../src/constants.js';
import { contextRuleForShiftCandidate } from '../src/utils/contextRule.js';
import { parseStoredExperimentsForPersistence } from '../src/utils/experimentStorage.js';

function trial(dateKey, scheduleId, outcome = 'success', index = scheduleId) {
  const failed = outcome === 'failure';
  return {
    id: `trial-${index}`,
    recordKey: `${dateKey}::${scheduleId}`,
    dateKey,
    scheduleId,
    planTitle: 'Work',
    outcome,
    observedValue: failed ? 1 : 0,
    observedLabel: failed ? '変更・スキップ' : '予定通り',
    capturedAt: `${dateKey}T10:00:00Z`,
  };
}

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
    completedAt: '2026-09-01T12:00:00Z',
    trials: [
      trial('2026-08-28', 'root-a', 'success', 'root-a'),
      trial('2026-08-29', 'root-b', 'success', 'root-b'),
      trial('2026-08-30', 'root-c', 'failure', 'root-c'),
    ],
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
  const baseTrial = trial('2026-08-28', 'work');
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, id: '' }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, observedLabel: 1 }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, outcome: 'maybe' }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, planTitle: undefined }] })).ok, false);
  assert.equal(parse(experiment({ trials: [{ ...baseTrial, capturedAt: undefined }] })).ok, false);
});

test('trial record identity, start date and target count are semantic persistence boundaries', () => {
  const base = trial('2026-08-28', 'work');
  assert.equal(parse(experiment({ trials: [{ ...base, recordKey: '2026-08-28::other' }] })).ok, false);
  assert.equal(parse(experiment({ trials: [trial('2026-08-27', 'early')] })).ok, false);
  assert.equal(parse(experiment({
    targetRuns: 3,
    trials: [
      trial('2026-08-28', 'a'),
      trial('2026-08-29', 'b'),
      trial('2026-08-30', 'c'),
      trial('2026-08-31', 'd'),
    ],
  })).ok, false);
});

test('completed and abandoned lifecycle states cannot omit their required facts', () => {
  const threeTrials = [
    trial('2026-08-28', 'a'),
    trial('2026-08-29', 'b'),
    trial('2026-08-30', 'c'),
  ];
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials, decision: null, decisionDateKey: '2026-08-31', completedAt: '2026-08-31T12:00:00Z' })).ok, false);
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials, decision: 'adopt', decisionDateKey: null, completedAt: '2026-08-31T12:00:00Z' })).ok, false);
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials, decision: 'adopt', decisionDateKey: '2026-08-31', completedAt: '' })).ok, false);
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials.slice(0, 2), decision: 'adopt', decisionDateKey: '2026-08-31', completedAt: '2026-08-31T12:00:00Z' })).ok, false);
  assert.equal(parse(experiment({ status: 'abandoned', completedAt: '' })).ok, false);
  assert.equal(parse(experiment({ status: 'abandoned', completedAt: '2026-08-29T12:00:00Z', decision: 'adopt' })).ok, false);
  assert.equal(parse(experiment({ status: 'abandoned', completedAt: '2026-08-29T12:00:00Z' })).ok, true);
});

test('completion date cannot precede the experiment or its latest trial', () => {
  const threeTrials = [
    trial('2026-08-28', 'a'),
    trial('2026-08-29', 'b'),
    trial('2026-08-30', 'c'),
  ];
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials, decision: 'adopt', decisionDateKey: '2026-08-27', completedAt: '2026-08-31T12:00:00Z' })).ok, false);
  assert.equal(parse(experiment({ status: 'completed', trials: threeTrials, decision: 'adopt', decisionDateKey: '2026-08-29', completedAt: '2026-08-31T12:00:00Z' })).ok, false);
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

test('context-scoped revalidation may use a contextual baseline while keeping parent provenance', () => {
  const root = adoptedRoot();
  const rule = contextRuleForShiftCandidate(
    { id: 'target-planned-stress', previousValue: 40, recentValue: 70 },
    '2026-09-10',
  );
  const result = parseMany([root, revalidationChild({
    contextRule: rule,
    baselineFailureRate: 0.75,
    baselineSampleCount: 4,
  })]);
  assert.equal(result.ok, true);
});

test('root learning versions cannot claim a revalidation source snapshot', () => {
  const retention = revalidationChild().sourceRetention;
  assert.equal(parse(adoptedRoot({ sourceRetention: retention })).ok, false);
});

test('valid explicit experiment metadata and realistic revalidation lineage remain writable', () => {
  const root = adoptedRoot();
  const child = revalidationChild();
  const result = parseMany([root, child]);
  assert.equal(result.ok, true);
  assert.equal(result.experiments[0].trials[0].id, 'trial-root-a');
  assert.equal(result.experiments[1].parentExperimentId, 'root');
  assert.equal(result.experiments[1].sourceRetention.experimentId, 'root');
});
