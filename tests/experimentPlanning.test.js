import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExperimentFromCandidate,
  EXPERIMENT_DECISION,
  finishExperiment,
  normalizeExperiment,
  PLAN_ADJUSTMENT_KIND,
  planAdjustmentLabel,
} from '../src/utils/experiment.js';

const candidate = {
  id: 'weekday-outcome-0',
  type: 'weekday-outcome',
  effectPoints: 30,
  title: '月曜の変更率が高い',
  hypothesis: '余白が役立つかもしれない',
};

test('new experiments store an explicit reusable plan adjustment instead of inferring it from free text later', () => {
  const experiment = createExperimentFromCandidate(candidate, {
    id: 'exp',
    startDateKey: '2026-08-25',
    anchorDateKey: '2026-08-24',
    days: {},
    action: '自分なりの対策説明',
  });
  assert.deepEqual(experiment.planAdjustment, { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 });
  assert.equal(planAdjustmentLabel(experiment.planAdjustment), '対象予定の前に15分の余白を追加');
});

test('invalid structured adjustments are discarded rather than repaired from the action text', () => {
  const experiment = normalizeExperiment({
    id: 'exp', title: 'Test', action: '15分余白を置く', metricKind: 'deviation', condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-25', targetRuns: 3, planAdjustment: { kind: 'unknown', minutes: 15 }, status: 'active', trials: [],
  });
  assert.equal(experiment.planAdjustment, null);
});

test('adoption stores a separate local decision date only when explicitly supplied', () => {
  const active = normalizeExperiment({
    id: 'exp', title: 'Test', action: '対策', metricKind: 'deviation', condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-25', targetRuns: 3, baselineFailureRate: 0.8, status: 'active',
    trials: [
      { recordKey: 'a', dateKey: '2026-08-25', outcome: 'success' },
      { recordKey: 'b', dateKey: '2026-09-01', outcome: 'success' },
      { recordKey: 'c', dateKey: '2026-09-08', outcome: 'success' },
    ],
  });
  const completed = finishExperiment(active, EXPERIMENT_DECISION.ADOPT, '2026-09-08T15:30:00.000Z', '2026-09-09');
  assert.equal(completed.decisionDateKey, '2026-09-09');

  const legacyStyle = finishExperiment(active, EXPERIMENT_DECISION.ADOPT, '2026-09-08T15:30:00.000Z');
  assert.equal(legacyStyle.decisionDateKey, null);
});
