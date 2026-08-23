import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import {
  applyWeeklyPlanFeedback,
  buildWeeklyPlanFeedback,
  simulateWeeklyPlanFeedback,
} from '../src/utils/weeklyPlanningFeedback.js';

function pending(id, time, title, category = '仕事', duration = 60, plannedStress = 50) {
  return {
    id, time, title, category, duration, plannedStress,
    status: STATUS.PENDING,
    appliedExperimentIds: [],
  };
}

function trial(id, outcome, dateKey = '2026-08-10') {
  return {
    id,
    recordKey: `${dateKey}::${id}`,
    dateKey,
    scheduleId: id,
    planTitle: 'Historical plan',
    outcome,
    observedValue: outcome === 'failure' ? 1 : 0,
    observedLabel: outcome === 'failure' ? '変更・スキップ' : '予定通り',
    capturedAt: `${dateKey}T12:00:00Z`,
  };
}

function adoptedExperiment(id, {
  condition = { kind: 'planned-category', value: '仕事' },
  planAdjustment = { kind: 'buffer-before', minutes: 15 },
  outcomes = ['success', 'success', 'failure'],
  baselineFailureRate = 0.7,
  decisionDateKey = '2026-08-24',
} = {}) {
  return {
    id,
    candidateId: `candidate-${id}`,
    candidateType: 'category-outcome',
    title: `Experiment ${id}`,
    hypothesis: 'Small adjustment may help.',
    action: '明示的な小さな対策',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition,
    startDateKey: '2026-08-01',
    targetRuns: Math.max(3, outcomes.length),
    baselineFailureRate,
    baselineSampleCount: 12,
    planAdjustment,
    status: 'completed',
    decision: 'adopt',
    decisionDateKey,
    trials: outcomes.map((outcome, index) => trial(`${id}-${index + 1}`, outcome, `2026-08-${String(10 + index).padStart(2, '0')}`)),
    createdAt: '2026-08-01T00:00:00Z',
    completedAt: '2026-08-23T00:00:00Z',
  };
}

test('weekly feedback only includes today and future dates inside the selected Monday-Sunday week', () => {
  const experiment = adoptedExperiment('work-buffer');
  const days = {
    '2026-08-24': [pending('mon', '09:00', 'Monday work')],
    '2026-08-25': [pending('tue', '09:00', 'Tuesday work')],
    '2026-08-26': [pending('wed', '09:00', 'Wednesday work')],
    '2026-08-28': [pending('fri', '09:00', 'Friday work')],
  };
  const weekly = buildWeeklyPlanFeedback([experiment], days, '2026-08-26', '2026-08-26');
  assert.deepEqual(weekly.dateKeys, ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30']);
  assert.deepEqual(weekly.suggestions.map((item) => item.dateKey), ['2026-08-26', '2026-08-28']);
  assert.equal(weekly.actionableCount, 2);
});

test('evidence review order uses more trials before effect size but does not auto-select anything', () => {
  const moreTrials = adoptedExperiment('more-trials', {
    outcomes: ['success', 'success', 'success', 'failure', 'failure'],
    baselineFailureRate: 0.7,
  });
  const biggerDifference = adoptedExperiment('bigger-difference', {
    outcomes: ['success', 'success', 'success'],
    baselineFailureRate: 0.9,
  });
  const days = { '2026-08-24': [pending('work', '09:00', 'Work')] };
  const weekly = buildWeeklyPlanFeedback([biggerDifference, moreTrials], days, '2026-08-24', '2026-08-24');
  const byExperiment = new Map(weekly.suggestions.map((item) => [item.experimentId, item]));
  assert.equal(byExperiment.get('more-trials').evidenceOrder, 1);
  assert.equal(byExperiment.get('bigger-difference').evidenceOrder, 2);
  const simulation = simulateWeeklyPlanFeedback([moreTrials, biggerDifference], days, weekly, []);
  assert.equal(simulation.ok, false);
  assert.equal(simulation.selectedCount, 0);
});

test('weekly bulk apply refuses multiple adopted adjustments targeting the same plan instead of choosing a winner', () => {
  const buffer = adoptedExperiment('buffer');
  const shorten = adoptedExperiment('shorten', { planAdjustment: { kind: 'shorten-duration', minutes: 15 } });
  const days = { '2026-08-24': [pending('work', '09:00', 'Work')] };
  const weekly = buildWeeklyPlanFeedback([buffer, shorten], days, '2026-08-24', '2026-08-24');
  assert.equal(weekly.multipleTargetGroups.length, 1);
  const selectedIds = weekly.suggestions.map((item) => item.id);
  const simulation = simulateWeeklyPlanFeedback([buffer, shorten], days, weekly, selectedIds);
  assert.equal(simulation.ok, false);
  assert.match(simulation.error, /同じ予定/);
  assert.deepEqual(simulation.days, days);
});

test('weekly simulation catches a new cross-plan time collision created by the selected combination and stays atomic', () => {
  const workBuffer = adoptedExperiment('work-buffer', {
    condition: { kind: 'planned-category', value: '仕事' },
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
  });
  const exerciseShift = adoptedExperiment('exercise-shift', {
    condition: { kind: 'planned-category', value: '運動' },
    planAdjustment: { kind: 'shift-start-later', minutes: 15 },
  });
  const days = {
    '2026-08-24': [
      pending('exercise', '09:30', 'Exercise', '運動', 15),
      pending('work', '10:00', 'Work', '仕事', 60),
    ],
  };
  const weekly = buildWeeklyPlanFeedback([workBuffer, exerciseShift], days, '2026-08-24', '2026-08-24');
  assert.equal(weekly.actionableCount, 2);
  const simulation = simulateWeeklyPlanFeedback([workBuffer, exerciseShift], days, weekly, weekly.suggestions.map((item) => item.id));
  assert.equal(simulation.ok, false);
  assert.match(simulation.error, /競合/);
  assert.deepEqual(simulation.days, days);
});

test('valid weekly selections apply across multiple days in one result and preserve source days', () => {
  const workBuffer = adoptedExperiment('work-buffer', {
    condition: { kind: 'planned-category', value: '仕事' },
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
  });
  const exerciseShorten = adoptedExperiment('exercise-shorten', {
    condition: { kind: 'planned-category', value: '運動' },
    planAdjustment: { kind: 'shorten-duration', minutes: 15 },
  });
  const days = {
    '2026-08-24': [pending('work', '10:00', 'Work', '仕事', 60)],
    '2026-08-25': [pending('exercise', '18:00', 'Exercise', '運動', 60)],
  };
  const original = JSON.parse(JSON.stringify(days));
  const weekly = buildWeeklyPlanFeedback([workBuffer, exerciseShorten], days, '2026-08-24', '2026-08-24');
  let idCounter = 0;
  const result = applyWeeklyPlanFeedback(
    [workBuffer, exerciseShorten],
    days,
    weekly,
    weekly.suggestions.map((item) => item.id),
    () => `new-${++idCounter}`,
  );
  assert.equal(result.ok, true);
  assert.equal(result.applied.length, 2);
  assert.deepEqual(days, original);

  const monday = result.days['2026-08-24'];
  assert.equal(monday.length, 2);
  assert.equal(monday.find((item) => item.id === 'work').appliedExperimentIds.includes('work-buffer'), true);
  assert.equal(monday.some((item) => item.title === '調整バッファ' && item.time === '09:45'), true);

  const tuesdayExercise = result.days['2026-08-25'].find((item) => item.id === 'exercise');
  assert.equal(tuesdayExercise.duration, 45);
  assert.equal(tuesdayExercise.appliedExperimentIds.includes('exercise-shorten'), true);
});

test('legacy guidance-only learning remains visible in the weekly plan but cannot be selected for mutation', () => {
  const legacy = adoptedExperiment('legacy-guidance', { decisionDateKey: undefined });
  const days = { '2026-08-24': [pending('work', '09:00', 'Work')] };
  const weekly = buildWeeklyPlanFeedback([legacy], days, '2026-08-24', '2026-08-24');
  assert.equal(weekly.suggestions.length, 1);
  assert.equal(weekly.actionableCount, 0);
  assert.equal(weekly.guidanceCount, 1);
  assert.equal(weekly.suggestions[0].preview.canApply, false);
});
