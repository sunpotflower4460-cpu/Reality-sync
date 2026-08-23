import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import {
  addExperimentTrial,
  calculateExperimentResult,
  canCreateExperiment,
  createExperimentFromCandidate,
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  finishExperiment,
  listEligibleExperimentRecords,
  normalizeExperiment,
  parseStoredExperiments,
  removeExperimentTrial,
  serializeExperiments,
} from '../src/utils/experiment.js';

function recorded(id, overrides = {}) {
  const time = overrides.time ?? '09:00';
  const category = overrides.category ?? '仕事';
  const plannedStress = overrides.plannedStress ?? 50;
  return {
    id, time, title: overrides.title ?? 'Work', category, duration: 60, plannedStress,
    status: overrides.status ?? STATUS.AS_PLANNED,
    plannedSnapshot: { time, title: overrides.title ?? 'Work', category, duration: 60, plannedStress },
    actualTitle: overrides.actualTitle ?? 'Work', actualCategory: overrides.actualCategory ?? category,
    actualDuration: overrides.actualDuration ?? 60, actualStartTime: overrides.actualStartTime ?? '09:05',
    actualStartDateKey: overrides.actualStartDateKey, actualStress: 40, mood: 'normal',
    deviationReason: overrides.deviationReason ?? null,
  };
}

const mondayCandidate = {
  id: 'weekday-outcome-0', type: 'weekday-outcome', effectPoints: 30,
  title: '月曜の変更・スキップ率が高い', hypothesis: '月曜には余白が必要かもしれません。',
};

test('only elevated objective candidates are eligible for a small experiment', () => {
  assert.equal(canCreateExperiment(mondayCandidate), true);
  assert.equal(canCreateExperiment({ ...mondayCandidate, effectPoints: -30 }), false);
  assert.equal(canCreateExperiment({ id: 'reason-rain', type: 'repeated-reason', effectPoints: 40 }), false);
});

test('experiment creation snapshots a truthful historical baseline from matching records', () => {
  const days = {
    '2026-08-03': [recorded('a', { status: STATUS.CHANGED, actualStartDateKey: '2026-08-03' })],
    '2026-08-10': [recorded('b', { status: STATUS.AS_PLANNED, actualStartDateKey: '2026-08-10' })],
    '2026-08-17': [recorded('c', { status: STATUS.SKIPPED, actualStartTime: null, actualStartDateKey: null })],
  };
  const experiment = createExperimentFromCandidate(mondayCandidate, {
    id: 'exp', startDateKey: '2026-08-24', anchorDateKey: '2026-08-23', days,
    action: '月曜の前後に15分の余白を置く', targetRuns: 3, createdAt: '2026-08-23T00:00:00Z',
  });
  assert.equal(experiment.baselineSampleCount, 3);
  assert.equal(experiment.baselineFailureRate, 2 / 3);
  assert.equal(experiment.trials.length, 0);
  assert.equal(experiment.status, EXPERIMENT_STATUS.ACTIVE);
});

test('eligible records are never counted as trials until the user explicitly captures them', () => {
  const experiment = createExperimentFromCandidate(mondayCandidate, {
    id: 'exp', startDateKey: '2026-08-24', anchorDateKey: '2026-08-23', days: {}, action: '余白を置く', targetRuns: 3,
  });
  const days = {
    '2026-08-24': [recorded('a', { actualStartDateKey: '2026-08-24' })],
    '2026-08-25': [recorded('not-monday', { status: STATUS.CHANGED, actualStartDateKey: '2026-08-25' })],
  };
  const eligible = listEligibleExperimentRecords(experiment, days, '2026-08-25');
  assert.equal(eligible.length, 1);
  assert.equal(calculateExperimentResult(experiment).trialCount, 0);

  const captured = addExperimentTrial(experiment, eligible[0], '2026-08-25T00:00:00Z');
  assert.equal(captured.trials.length, 1);
  assert.equal(captured.trials[0].outcome, 'success');
  const removed = removeExperimentTrial(captured, eligible[0].recordKey);
  assert.equal(removed.trials.length, 0);
});

test('captured trial result is snapshotted and later source edits do not rewrite it', () => {
  const experiment = normalizeExperiment({
    id: 'exp', candidateId: 'weekday-outcome-0', candidateType: 'weekday-outcome', title: 'Monday', hypothesis: '', action: '余白',
    metricKind: 'deviation', metricLabel: '変更・スキップ', condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3,
    baselineFailureRate: 0.8, baselineSampleCount: 10, trials: [], status: 'active',
  });
  const source = { '2026-08-24': [recorded('a', { status: STATUS.CHANGED, actualStartDateKey: '2026-08-24' })] };
  const [eligible] = listEligibleExperimentRecords(experiment, source, '2026-08-24');
  const captured = addExperimentTrial(experiment, eligible);
  source['2026-08-24'][0].status = STATUS.AS_PLANNED;
  assert.equal(captured.trials[0].outcome, 'failure');
});

test('late-start experiments require exact recorded timing and use the 20 minute threshold', () => {
  const candidate = { id: 'weekday-late-0', type: 'weekday-late-start', effectPoints: 25, title: 'Monday late', hypothesis: 'buffer' };
  const experiment = createExperimentFromCandidate(candidate, { id: 'late', startDateKey: '2026-08-24', anchorDateKey: '2026-08-23', days: {}, action: '余白' });
  const days = { '2026-08-24': [
    recorded('late', { actualStartTime: '09:25', actualStartDateKey: '2026-08-24' }),
    recorded('ontime', { actualStartTime: '09:10', actualStartDateKey: '2026-08-24' }),
    recorded('unknown', { actualStartTime: null, actualStartDateKey: null }),
  ] };
  const eligible = listEligibleExperimentRecords(experiment, days, '2026-08-24');
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map((item) => item.outcome).sort(), ['failure', 'success']);
});

test('target completion reports direction but user decision remains explicit', () => {
  let experiment = normalizeExperiment({
    id: 'exp', title: 'Test', action: '対策', metricKind: 'deviation', metricLabel: '変更', condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-24', targetRuns: 3, baselineFailureRate: 0.8, baselineSampleCount: 10, status: 'active', trials: [],
  });
  for (let index = 0; index < 3; index += 1) experiment = addExperimentTrial(experiment, { recordKey: `k${index}`, dateKey: '2026-08-24', scheduleId: `s${index}`, planTitle: 'Work', outcome: 'success', observedValue: 0, observedLabel: '予定通り' });
  const result = calculateExperimentResult(experiment);
  assert.equal(result.targetMet, true);
  assert.equal(result.signal, 'improving');
  assert.equal(experiment.status, EXPERIMENT_STATUS.ACTIVE);
  const completed = finishExperiment(experiment, EXPERIMENT_DECISION.ADOPT, '2026-08-30T00:00:00Z');
  assert.equal(completed.status, EXPERIMENT_STATUS.COMPLETED);
  assert.equal(completed.decision, EXPERIMENT_DECISION.ADOPT);
});

test('experiment storage round-trips versioned normalized data', () => {
  const experiment = createExperimentFromCandidate(mondayCandidate, { id: 'exp', startDateKey: '2026-08-24', anchorDateKey: '2026-08-23', days: {}, action: '余白' });
  const parsed = parseStoredExperiments(serializeExperiments([experiment]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'exp');
  assert.equal(parseStoredExperiments('{broken').length, 0);
});
