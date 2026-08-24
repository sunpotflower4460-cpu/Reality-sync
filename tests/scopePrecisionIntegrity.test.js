import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { normalizeExperiment } from '../src/utils/experiment.js';
import { calculateScopePrecisionSummary, SCOPE_PRECISION_SIGNAL } from '../src/utils/scopePrecision.js';
import { shiftDateKey } from '../src/utils/date.js';

function target(id, dateKey, failed = false) {
  return {
    id,
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    appliedExperimentIds: ['v1'],
    status: failed ? STATUS.CHANGED : STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50 },
    actualTitle: failed ? 'Changed work' : 'Work',
    actualCategory: '仕事',
    actualDuration: 60,
    actualStartTime: '09:00',
    actualStartDateKey: dateKey,
    deviationReason: failed ? '変更' : null,
    actualStress: 50,
    mood: 'normal',
  };
}

function companion(id, dateKey, duration, legacy = false) {
  return {
    id,
    time: '13:00',
    title: 'Companion',
    category: '家事',
    duration,
    plannedStress: 30,
    appliedExperimentIds: [],
    status: STATUS.AS_PLANNED,
    plannedSnapshot: legacy ? null : { time: '13:00', title: 'Companion', category: '家事', duration, plannedStress: 30 },
    actualTitle: 'Companion',
    actualCategory: '家事',
    actualDuration: duration,
    actualStartTime: '13:00',
    actualStartDateKey: dateKey,
    deviationReason: null,
    actualStress: 30,
    mood: 'normal',
  };
}

function parentExperiment() {
  return normalizeExperiment({
    id: 'v1', learningRootId: 'root', learningVersion: 1, parentExperimentId: null,
    title: 'Work learning', hypothesis: 'Work learning', action: '15分余白',
    metricKind: 'deviation', metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' }, contextRule: null,
    startDateKey: '2025-12-01', targetRuns: 3,
    baselineFailureRate: 0.5, baselineSampleCount: 12,
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-01-01',
    trials: [
      { recordKey: 't1', dateKey: '2025-12-01', scheduleId: 't1', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't2', dateKey: '2025-12-08', scheduleId: 't2', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't3', dateKey: '2025-12-15', scheduleId: 't3', planTitle: 'Work', outcome: 'failure' },
    ],
    createdAt: '2025-11-30T00:00:00Z', completedAt: '2025-12-20T00:00:00Z',
  });
}

function conditionalExperiment() {
  return normalizeExperiment({
    id: 'v2', learningRootId: 'root', learningVersion: 2, parentExperimentId: 'v1',
    title: 'Work learning', hypothesis: 'Work learning', action: '30分余白',
    metricKind: 'deviation', metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' },
    contextRule: {
      metric: 'day-planned-minutes', operator: 'gte', threshold: 120, category: null,
      sourceCandidateId: 'day-planned-minutes', sourcePreviousValue: 90, sourceRecentValue: 150,
      sourceThroughDateKey: '2026-03-30',
    },
    startDateKey: '2026-03-31', targetRuns: 3,
    baselineFailureRate: 0.5, baselineSampleCount: 4,
    planAdjustment: { kind: 'buffer-before', minutes: 30 },
    revalidationReason: '再検証',
    sourceRetention: {
      experimentId: 'v1', throughDateKey: '2026-03-30', assessmentCount: 9, weekCount: 9,
      failureRate: 4 / 9, experimentFailureRate: 1 / 3, differenceFromExperimentPoints: 11,
      capturedAt: '2026-03-30T00:00:00Z',
    },
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-04-01',
    trials: [
      { recordKey: 'v2-1', dateKey: '2026-03-31', scheduleId: 'v2-1', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'v2-2', dateKey: '2026-03-31', scheduleId: 'v2-2', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'v2-3', dateKey: '2026-03-31', scheduleId: 'v2-3', planTitle: 'Work', outcome: 'failure' },
    ],
    createdAt: '2026-03-30T00:00:00Z', completedAt: '2026-03-31T23:00:00Z',
  });
}

test('scope precision aggregation excludes unknown parent history from both inside and outside groups', () => {
  const days = {};
  for (let index = 0; index < 9; index += 1) {
    const dateKey = shiftDateKey('2026-01-05', index * 7);
    if (index < 4) days[dateKey] = [target(`inside-${index}`, dateKey, true), companion(`inside-companion-${index}`, dateKey, 90)];
    else if (index < 8) days[dateKey] = [target(`outside-${index}`, dateKey, false), companion(`outside-companion-${index}`, dateKey, 30)];
    else days[dateKey] = [target('unknown', dateKey, true), companion('legacy-companion', dateKey, 90, true)];
  }

  const parent = parentExperiment();
  const current = conditionalExperiment();
  const summary = calculateScopePrecisionSummary(current, [parent, current], days, '2026-04-06');

  assert.equal(summary.signal, SCOPE_PRECISION_SIGNAL.FOCUSED);
  assert.equal(summary.source.inside.count, 4);
  assert.equal(summary.source.outside.count, 4);
  assert.equal(summary.source.unknownCount, 1);
  assert.equal(summary.source.inside.failureRate, 1);
  assert.equal(summary.source.outside.failureRate, 0);
});
