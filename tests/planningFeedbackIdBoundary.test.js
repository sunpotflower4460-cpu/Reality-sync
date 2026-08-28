import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { EXPERIMENT_DECISION, EXPERIMENT_STATUS, normalizeExperiment, PLAN_ADJUSTMENT_KIND } from '../src/utils/experiment.js';
import { applyPlanFeedback } from '../src/utils/planningFeedback.js';

function pending(id, time = '09:00') {
  return {
    id,
    time,
    title: id === 'existing-buffer' ? 'Existing' : 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    appliedExperimentIds: [],
    status: STATUS.PENDING,
  };
}

function adoptedBufferExperiment() {
  return normalizeExperiment({
    id: 'exp-buffer',
    title: 'Monday buffer',
    action: '15分の余白を置く',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-10',
    targetRuns: 3,
    baselineFailureRate: 0.8,
    baselineSampleCount: 10,
    planAdjustment: { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 },
    status: EXPERIMENT_STATUS.COMPLETED,
    decision: EXPERIMENT_DECISION.ADOPT,
    decisionDateKey: '2026-08-24',
    trials: [],
  });
}

test('buffer feedback is atomic when the generated schedule id collides with an existing plan', () => {
  const experiment = adoptedBufferExperiment();
  const schedules = [pending('work'), pending('existing-buffer', '12:00')];

  const result = applyPlanFeedback(experiment, '2026-08-24', schedules, 'work', 'existing-buffer');

  assert.equal(result.ok, false);
  assert.match(result.error, /既存予定と重複/);
  assert.equal(result.schedules.length, 2);
  const target = result.schedules.find((schedule) => schedule.id === 'work');
  assert.deepEqual(target.appliedExperimentIds, []);
});
