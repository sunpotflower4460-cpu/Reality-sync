import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { evaluateContextRule, normalizeContextRule } from '../src/utils/contextRule.js';
import { shiftDateKey } from '../src/utils/date.js';
import { normalizeExperiment } from '../src/utils/experiment.js';
import { calculateScopePrecisionSummary, SCOPE_PRECISION_SIGNAL } from '../src/utils/scopePrecision.js';

function experiment(overrides = {}) {
  return normalizeExperiment({
    id: overrides.id ?? 'v1',
    learningRootId: 'root',
    learningVersion: overrides.learningVersion ?? 1,
    parentExperimentId: overrides.parentExperimentId ?? null,
    title: 'Work buffer',
    hypothesis: 'Work buffer',
    action: overrides.action ?? '15分余白',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' },
    contextRule: overrides.contextRule ?? null,
    startDateKey: overrides.startDateKey ?? '2025-12-01',
    targetRuns: 3,
    baselineFailureRate: 0.5,
    baselineSampleCount: 12,
    planAdjustment: overrides.planAdjustment ?? { kind: 'buffer-before', minutes: 15 },
    revalidationReason: overrides.parentExperimentId ? '再検証' : '',
    sourceRetention: overrides.parentExperimentId ? {
      experimentId: overrides.parentExperimentId,
      throughDateKey: '2026-03-30',
      assessmentCount: 8,
      weekCount: 8,
      failureRate: 0.5,
      experimentFailureRate: 1 / 3,
      differenceFromExperimentPoints: 17,
      capturedAt: '2026-03-30T00:00:00Z',
    } : null,
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: overrides.decisionDateKey ?? (overrides.parentExperimentId ? '2026-04-01' : '2026-01-01'),
    trials: [
      { recordKey: 't1', dateKey: '2025-12-01', scheduleId: 't1', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't2', dateKey: '2025-12-08', scheduleId: 't2', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't3', dateKey: '2025-12-15', scheduleId: 't3', planTitle: 'Work', outcome: 'failure' },
    ],
    createdAt: '2025-11-30T00:00:00Z',
    completedAt: '2025-12-20T00:00:00Z',
  });
}

function rule() {
  return normalizeContextRule({
    metric: 'target-planned-stress',
    operator: 'gte',
    threshold: 55,
    category: null,
    sourceCandidateId: 'target-planned-stress',
    sourcePreviousValue: 40,
    sourceRecentValue: 70,
    sourceThroughDateKey: '2026-03-30',
  });
}

function recorded(id, dateKey, { stress = 70, failed = false, applied = ['v1'], category = '仕事' } = {}) {
  return {
    id,
    time: '09:00',
    title: 'Work',
    category,
    duration: 60,
    plannedStress: stress,
    appliedExperimentIds: applied,
    status: failed ? STATUS.CHANGED : STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Work', category, duration: 60, plannedStress: stress },
    actualTitle: failed ? 'Changed work' : 'Work',
    actualCategory: category,
    actualDuration: 60,
    actualStartTime: '09:05',
    actualStartDateKey: dateKey,
    deviationReason: failed ? '変更' : null,
    actualStress: stress,
    mood: 'normal',
  };
}

function sourceDays({ reverse = false, insideCount = 4, outsideCount = 4 } = {}) {
  const days = {};
  for (let index = 0; index < Math.max(insideCount, outsideCount); index += 1) {
    const dateKey = shiftDateKey('2026-01-05', index * 7);
    const schedules = [];
    if (index < insideCount) schedules.push(recorded(`in-${index}`, dateKey, { stress: 70, failed: !reverse, applied: ['v1'] }));
    if (index < outsideCount) schedules.push(recorded(`out-${index}`, dateKey, { stress: 40, failed: reverse, applied: ['v1'] }));
    days[dateKey] = schedules;
  }
  return days;
}

function addCoverageDays(days) {
  return {
    ...days,
    '2026-04-06': [
      recorded('current-in-applied', '2026-04-06', { stress: 70, applied: ['v2'] }),
      recorded('current-in-unapplied', '2026-04-06', { stress: 80, applied: [] }),
      recorded('current-out', '2026-04-06', { stress: 40, applied: [] }),
      recorded('current-out-leak', '2026-04-06', { stress: 30, applied: ['v2'] }),
      recorded('other-category', '2026-04-06', { stress: 90, applied: ['v2'], category: '家事' }),
    ],
  };
}

test('context evaluation keeps unknown historical day context separate from outside-rule reality', () => {
  const dayRule = normalizeContextRule({
    metric: 'day-planned-minutes', operator: 'gte', threshold: 120, category: null,
    sourceCandidateId: 'day-planned-minutes', sourcePreviousValue: 60, sourceRecentValue: 180,
    sourceThroughDateKey: '2026-03-30',
  });
  const target = recorded('target', '2026-01-05', { stress: 70 });
  const legacy = { ...recorded('legacy', '2026-01-05', { stress: 20 }), plannedSnapshot: null };
  const evaluation = evaluateContextRule(dayRule, target, [target, legacy]);
  assert.equal(evaluation.known, false);
  assert.equal(evaluation.matches, false);
  assert.equal(evaluation.value, null);
});

test('scope precision finds a focused condition from the previous adopted version and reports current coverage separately', () => {
  const parent = experiment({ id: 'v1' });
  const current = experiment({ id: 'v2', learningVersion: 2, parentExperimentId: 'v1', contextRule: rule() });
  const summary = calculateScopePrecisionSummary(current, [parent, current], addCoverageDays(sourceDays()), '2026-04-06');

  assert.equal(summary.signal, SCOPE_PRECISION_SIGNAL.FOCUSED);
  assert.equal(summary.source.inside.count, 4);
  assert.equal(summary.source.inside.failureRate, 1);
  assert.equal(summary.source.outside.count, 4);
  assert.equal(summary.source.outside.failureRate, 0);
  assert.equal(summary.source.differencePoints, 100);
  assert.equal(summary.coverage.baseConditionCount, 4);
  assert.equal(summary.coverage.insideCount, 2);
  assert.equal(summary.coverage.outsideCount, 2);
  assert.equal(summary.coverage.ruleCoverage, 0.5);
  assert.equal(summary.coverage.insideAppliedCount, 1);
  assert.equal(summary.coverage.applicationCoverage, 0.5);
  assert.equal(summary.coverage.outsideAppliedCount, 1);
});

test('scope precision stays collecting when either side lacks enough repeated source observations', () => {
  const parent = experiment({ id: 'v1' });
  const current = experiment({ id: 'v2', learningVersion: 2, parentExperimentId: 'v1', contextRule: rule() });
  const summary = calculateScopePrecisionSummary(current, [parent, current], sourceDays({ insideCount: 3, outsideCount: 5 }), '2026-04-06');
  assert.equal(summary.signal, SCOPE_PRECISION_SIGNAL.COLLECTING);
  assert.equal(summary.source.enoughData, false);
  assert.match(summary.reason, /それぞれ4件以上・2週以上/);
});

test('scope precision flags reverse separation without changing or broadening the stored learning', () => {
  const parent = experiment({ id: 'v1' });
  const current = experiment({ id: 'v2', learningVersion: 2, parentExperimentId: 'v1', contextRule: rule() });
  const originalRule = structuredClone(current.contextRule);
  const summary = calculateScopePrecisionSummary(current, [parent, current], sourceDays({ reverse: true }), '2026-04-06');
  assert.equal(summary.signal, SCOPE_PRECISION_SIGNAL.REVERSE);
  assert.equal(summary.source.differencePoints, -100);
  assert.deepEqual(current.contextRule, originalRule);
  assert.match(summary.reason, /自動では条件を広げません/);
});

test('unconditional or non-adopted experiments do not receive a scope precision claim', () => {
  const parent = experiment({ id: 'v1' });
  assert.equal(calculateScopePrecisionSummary(parent, [parent], sourceDays(), '2026-04-06'), null);
  const current = normalizeExperiment({
    ...experiment({ id: 'v2', learningVersion: 2, parentExperimentId: 'v1', contextRule: rule() }),
    decision: 'hold',
  });
  assert.equal(calculateScopePrecisionSummary(current, [parent, current], sourceDays(), '2026-04-06'), null);
});
