import test from 'node:test';
import assert from 'node:assert/strict';
import { contextRuleForShiftCandidate } from '../src/utils/contextRule.js';
import { createRevalidationExperiment, normalizeExperiment } from '../src/utils/experiment.js';

test('core revalidation creation rejects a forged contextual baseline that lacks two calendar weeks', () => {
  const source = normalizeExperiment({
    id: 'v1', learningRootId: 'v1', learningVersion: 1, parentExperimentId: null,
    title: 'Work learning', action: '15分余白', metricKind: 'deviation', metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' }, startDateKey: '2026-06-01', targetRuns: 3,
    baselineFailureRate: 0.6, baselineSampleCount: 20, planAdjustment: { kind: 'buffer-before', minutes: 15 },
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-07-01',
    trials: [
      { recordKey: 'a', dateKey: '2026-06-01', scheduleId: 'a', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'b', dateKey: '2026-06-02', scheduleId: 'b', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'c', dateKey: '2026-06-03', scheduleId: 'c', planTitle: 'Work', outcome: 'failure' },
    ],
  });
  const retention = {
    experimentId: 'v1', throughDateKey: '2026-08-10', reviewCandidate: true,
    assessmentCount: 8, weekCount: 4, failureRate: 0.6, experimentFailureRate: 1 / 3,
    differenceFromExperimentPoints: 27,
  };
  const rule = contextRuleForShiftCandidate(
    { id: 'target-planned-stress', previousValue: 40, recentValue: 70 },
    '2026-08-10',
  );

  const result = createRevalidationExperiment(source, retention, {
    id: 'v2', startDateKey: '2026-08-11', learningVersion: 2, contextRule: rule,
    contextBaseline: { ok: true, rate: 0.5, count: 4, weekCount: 1 },
  });

  assert.equal(result, null);
});
