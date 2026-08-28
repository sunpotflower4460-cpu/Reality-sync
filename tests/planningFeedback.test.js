import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import {
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  normalizeExperiment,
  PLAN_ADJUSTMENT_KIND,
} from '../src/utils/experiment.js';
import {
  applyPlanFeedback,
  buildPlanFeedbackSuggestions,
  createPlanFeedbackPreview,
} from '../src/utils/planningFeedback.js';

function pending(id, overrides = {}) {
  return {
    id,
    time: overrides.time ?? '09:00',
    title: overrides.title ?? 'Work',
    category: overrides.category ?? '仕事',
    duration: overrides.duration ?? 60,
    plannedStress: overrides.plannedStress ?? 50,
    appliedExperimentIds: overrides.appliedExperimentIds ?? [],
    status: overrides.status ?? STATUS.PENDING,
  };
}

function adoptedExperiment(overrides = {}) {
  return normalizeExperiment({
    id: overrides.id ?? 'exp',
    candidateId: 'weekday-outcome-0',
    candidateType: 'weekday-outcome',
    title: overrides.title ?? '月曜の変更率が高い',
    hypothesis: '余白が役立つかもしれない',
    action: overrides.action ?? '月曜の予定の前に15分の余白を置く',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: overrides.condition ?? { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-10',
    targetRuns: 3,
    baselineFailureRate: 0.8,
    baselineSampleCount: 10,
    planAdjustment: overrides.planAdjustment === undefined
      ? { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 }
      : overrides.planAdjustment,
    status: EXPERIMENT_STATUS.COMPLETED,
    decision: EXPERIMENT_DECISION.ADOPT,
    decisionDateKey: overrides.decisionDateKey === undefined ? '2026-08-24' : overrides.decisionDateKey,
    trials: [
      { recordKey: 'a', dateKey: '2026-08-10', scheduleId: 'a', planTitle: 'A', outcome: 'success' },
      { recordKey: 'b', dateKey: '2026-08-17', scheduleId: 'b', planTitle: 'B', outcome: 'success' },
      { recordKey: 'c', dateKey: '2026-08-17', scheduleId: 'c', planTitle: 'C', outcome: 'failure' },
    ],
    createdAt: '2026-08-09T00:00:00Z',
    completedAt: '2026-08-23T15:00:00Z',
  });
}

test('adopted planning feedback appears only on matching pending plans on or after the adoption date', () => {
  const experiment = adoptedExperiment();
  const schedules = [pending('work')];
  assert.equal(buildPlanFeedbackSuggestions([experiment], '2026-08-17', schedules).length, 0);
  assert.equal(buildPlanFeedbackSuggestions([experiment], '2026-08-24', schedules).length, 1);
  assert.equal(buildPlanFeedbackSuggestions([experiment], '2026-08-25', schedules).length, 0);
  assert.equal(buildPlanFeedbackSuggestions([experiment], '2026-08-24', [pending('done', { status: STATUS.AS_PLANNED })]).length, 0);
});

test('legacy adopted experiments without a trustworthy adoption date stay guidance-only', () => {
  const legacy = adoptedExperiment({ decisionDateKey: null });
  const [suggestion] = buildPlanFeedbackSuggestions([legacy], '2026-08-24', [pending('work')]);
  assert.ok(suggestion);
  assert.equal(suggestion.preview.canApply, false);
  assert.equal(suggestion.preview.kind, 'guidance-only');
  assert.match(suggestion.preview.error, /採用日/);
});

test('buffer feedback previews and applies a separate pending buffer without duplicating the same learning', () => {
  const experiment = adoptedExperiment();
  const schedules = [pending('work', { time: '09:00' })];
  const preview = createPlanFeedbackPreview(experiment, '2026-08-24', schedules, 'work');
  assert.equal(preview.canApply, true);
  assert.equal(preview.inserted.time, '08:45');
  assert.equal(preview.inserted.duration, 15);

  const applied = applyPlanFeedback(experiment, '2026-08-24', schedules, 'work', 'buffer');
  assert.equal(applied.ok, true);
  assert.equal(applied.schedules.length, 2);
  const target = applied.schedules.find((item) => item.id === 'work');
  const buffer = applied.schedules.find((item) => item.id === 'buffer');
  assert.deepEqual(target.appliedExperimentIds, ['exp']);
  assert.equal(buffer.title, '調整バッファ');
  assert.deepEqual(buffer.appliedExperimentIds, ['exp']);
  assert.equal(buildPlanFeedbackSuggestions([experiment], '2026-08-24', applied.schedules).length, 0);
});

test('buffer feedback is blocked when the inserted time overlaps another plan', () => {
  const experiment = adoptedExperiment();
  const schedules = [
    pending('work', { time: '09:00' }),
    pending('other', { time: '08:50', duration: 20, title: 'Other' }),
  ];
  const preview = createPlanFeedbackPreview(experiment, '2026-08-24', schedules, 'work');
  assert.equal(preview.canApply, false);
  assert.match(preview.error, /Other/);
});

test('shorten feedback changes only the pending duration and preserves an application marker', () => {
  const experiment = adoptedExperiment({
    id: 'stress-exp',
    condition: { kind: 'planned-stress-min', value: 70 },
    planAdjustment: { kind: PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION, minutes: 15 },
  });
  const schedules = [pending('heavy', { duration: 60, plannedStress: 80 })];
  const applied = applyPlanFeedback(experiment, '2026-08-24', schedules, 'heavy', 'unused');
  assert.equal(applied.ok, true);
  assert.equal(applied.schedules[0].duration, 45);
  assert.deepEqual(applied.schedules[0].appliedExperimentIds, ['stress-exp']);
});

test('feedback is blocked when the target cannot persist another application marker', () => {
  const experiment = adoptedExperiment({
    id: 'fifty-first',
    condition: { kind: 'planned-stress-min', value: 70 },
    planAdjustment: { kind: PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION, minutes: 15 },
  });
  const markerIds = Array.from({ length: 50 }, (_, index) => `old-${index}`);
  const schedules = [pending('full', { duration: 60, plannedStress: 80, appliedExperimentIds: markerIds })];

  const preview = createPlanFeedbackPreview(experiment, '2026-08-24', schedules, 'full');
  assert.equal(preview.canApply, false);
  assert.match(preview.error, /適用済みの工夫が多すぎる/);

  const applied = applyPlanFeedback(experiment, '2026-08-24', schedules, 'full', 'unused');
  assert.equal(applied.ok, false);
  assert.equal(applied.schedules[0].duration, 60);
  assert.deepEqual(applied.schedules[0].appliedExperimentIds, markerIds);
});

test('shift feedback refuses a change that would cross the day boundary', () => {
  const experiment = adoptedExperiment({
    id: 'category-exp',
    condition: { kind: 'planned-category', value: '仕事' },
    planAdjustment: { kind: PLAN_ADJUSTMENT_KIND.SHIFT_START_LATER, minutes: 15 },
  });
  const preview = createPlanFeedbackPreview(experiment, '2026-08-24', [pending('late', { time: '23:50', duration: 30 })], 'late');
  assert.equal(preview.canApply, false);
  assert.match(preview.error, /日付/);
});
