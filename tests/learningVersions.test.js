import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLearningLineages,
  createExperimentFromCandidate,
  createRevalidationExperiment,
  EXPERIMENT_DECISION,
  nextLearningVersion,
  normalizeExperiment,
  parseStoredExperiments,
  serializeExperiments,
} from '../src/utils/experiment.js';
import { adoptedExperiments } from '../src/utils/planningFeedback.js';
import { calculateRetentionSummaries } from '../src/utils/retention.js';

const candidate = {
  id: 'weekday-outcome-0',
  type: 'weekday-outcome',
  effectPoints: 30,
  title: '月曜の変更・スキップ率が高い',
  hypothesis: '月曜には余白が必要かもしれません。',
};

function trial(id, outcome = 'success') {
  return {
    id,
    recordKey: id,
    dateKey: '2026-08-24',
    scheduleId: id,
    planTitle: 'Work',
    outcome,
    observedValue: outcome === 'failure' ? 1 : 0,
    observedLabel: outcome === 'failure' ? '変更' : '予定通り',
  };
}

function adoptedV1() {
  return normalizeExperiment({
    id: 'v1',
    candidateId: candidate.id,
    candidateType: candidate.type,
    title: candidate.title,
    hypothesis: candidate.hypothesis,
    action: '15分の余白を置く',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-24',
    targetRuns: 3,
    baselineFailureRate: 0.7,
    baselineSampleCount: 10,
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
    learningRootId: 'v1',
    parentExperimentId: null,
    learningVersion: 1,
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-09-01',
    trials: [trial('a'), trial('b'), trial('c', 'failure')],
    createdAt: '2026-08-23T00:00:00Z',
    completedAt: '2026-08-31T00:00:00Z',
  });
}

const review = {
  experimentId: 'v1',
  throughDateKey: '2026-10-05',
  reviewCandidate: true,
  assessmentCount: 10,
  weekCount: 4,
  failureRate: 0.6,
  experimentFailureRate: 1 / 3,
  differenceFromExperimentPoints: 27,
};

test('new candidate experiments explicitly start a learning lineage at v1', () => {
  const experiment = createExperimentFromCandidate(candidate, {
    id: 'root', startDateKey: '2026-08-24', anchorDateKey: '2026-08-23', days: {}, action: '余白を置く',
  });
  assert.equal(experiment.learningRootId, 'root');
  assert.equal(experiment.parentExperimentId, null);
  assert.equal(experiment.learningVersion, 1);
  assert.equal(experiment.sourceRetention, null);
});

test('revalidation creates a new child version and snapshots current normal-operation baseline', () => {
  const source = adoptedV1();
  const v2 = createRevalidationExperiment(source, review, {
    id: 'v2',
    startDateKey: '2026-10-06',
    action: '30分の余白を試す',
    planAdjustment: { kind: 'buffer-before', minutes: 30 },
    targetRuns: 4,
    learningVersion: 2,
    createdAt: '2026-10-05T10:00:00Z',
  });
  assert.ok(v2);
  assert.equal(v2.learningRootId, 'v1');
  assert.equal(v2.parentExperimentId, 'v1');
  assert.equal(v2.learningVersion, 2);
  assert.equal(v2.baselineFailureRate, 0.6);
  assert.equal(v2.baselineSampleCount, 10);
  assert.equal(v2.sourceRetention.throughDateKey, '2026-10-05');
  assert.equal(v2.sourceRetention.differenceFromExperimentPoints, 27);
  assert.deepEqual(v2.planAdjustment, { kind: 'buffer-before', minutes: 30 });
});

test('revalidation refuses non-review data and refuses to include the assessment day itself', () => {
  const source = adoptedV1();
  assert.equal(createRevalidationExperiment(source, { ...review, reviewCandidate: false }, { id: 'bad', startDateKey: '2026-10-06', learningVersion: 2 }), null);
  assert.equal(createRevalidationExperiment(source, review, { id: 'same-day', startDateKey: '2026-10-05', learningVersion: 2 }), null);
});

test('next version uses the highest existing lineage version even when the latest attempt was rejected', () => {
  const source = adoptedV1();
  const v2 = normalizeExperiment({
    ...source,
    id: 'v2',
    learningRootId: 'v1',
    parentExperimentId: 'v1',
    learningVersion: 2,
    startDateKey: '2026-10-06',
    status: 'completed',
    decision: 'reject',
    decisionDateKey: '2026-10-12',
    action: '30分余白',
  });
  assert.equal(nextLearningVersion([source, v2], source), 3);
  const [lineage] = buildLearningLineages([v2, source]);
  assert.deepEqual(lineage.versions.map((item) => item.learningVersion), [1, 2]);
  assert.deepEqual(lineage.versions.map((item) => item.parentExperimentId), [null, 'v1']);
});

test('future planning uses only the latest adopted version in each lineage', () => {
  const source = adoptedV1();
  const v2 = normalizeExperiment({
    ...source,
    id: 'v2',
    learningRootId: 'v1',
    parentExperimentId: 'v1',
    learningVersion: 2,
    startDateKey: '2026-10-06',
    planAdjustment: { kind: 'buffer-before', minutes: 30 },
    status: 'completed',
    decision: EXPERIMENT_DECISION.ADOPT,
    decisionDateKey: '2026-10-12',
    action: '30分余白',
  });
  assert.deepEqual(adoptedExperiments([source, v2]).map((item) => item.id), ['v2']);

  const rejectedV2 = { ...v2, decision: EXPERIMENT_DECISION.REJECT };
  assert.deepEqual(adoptedExperiments([source, rejectedV2]).map((item) => item.id), ['v1']);
});

test('retention summaries also move to the latest adopted version instead of monitoring superseded versions', () => {
  const source = adoptedV1();
  const v2 = normalizeExperiment({
    ...source,
    id: 'v2',
    learningRootId: 'v1',
    parentExperimentId: 'v1',
    learningVersion: 2,
    startDateKey: '2026-10-06',
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-10-12',
    action: '30分余白',
  });
  const summaries = calculateRetentionSummaries([source, v2], {}, '2026-10-20');
  assert.deepEqual(summaries.map((summary) => summary.experimentId), ['v2']);
});

test('experiment storage round-trip preserves learning lineage and the revalidation source snapshot', () => {
  const source = adoptedV1();
  const v2 = createRevalidationExperiment(source, review, {
    id: 'v2', startDateKey: '2026-10-06', learningVersion: 2, createdAt: '2026-10-05T10:00:00Z',
  });
  const parsed = parseStoredExperiments(serializeExperiments([source, v2]));
  assert.equal(parsed[1].parentExperimentId, 'v1');
  assert.equal(parsed[1].learningRootId, 'v1');
  assert.equal(parsed[1].learningVersion, 2);
  assert.equal(parsed[1].sourceRetention.failureRate, 0.6);
});
