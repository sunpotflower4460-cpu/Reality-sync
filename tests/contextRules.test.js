import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup, serializeBackup } from '../src/utils/backup.js';
import {
  buildContextualRetentionBaseline,
  contextRuleForShiftCandidate,
  contextRuleLabel,
  contextRuleMatches,
} from '../src/utils/contextRule.js';
import { createRevalidationExperiment, listEligibleExperimentRecords, normalizeExperiment } from '../src/utils/experiment.js';
import { buildPlanFeedbackSuggestions } from '../src/utils/planningFeedback.js';
import { STATUS } from '../src/constants.js';

function recorded(id, dateKey, { stress = 70, duration = 60, failed = false, experimentIds = [] } = {}) {
  return {
    id,
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration,
    plannedStress: stress,
    appliedExperimentIds: experimentIds,
    status: failed ? STATUS.CHANGED : STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Work', category: '仕事', duration, plannedStress: stress },
    actualTitle: failed ? 'Changed work' : 'Work',
    actualCategory: '仕事',
    actualDuration: duration,
    actualStartTime: '09:05',
    actualStartDateKey: dateKey,
    deviationReason: failed ? '変更' : null,
    actualStress: stress,
    mood: 'normal',
  };
}

function pending(id, { stress = 70, duration = 60, title = 'Work', category = '仕事', experimentIds = [] } = {}) {
  return {
    id,
    time: '09:00',
    title,
    category,
    duration,
    plannedStress: stress,
    appliedExperimentIds: experimentIds,
    status: STATUS.PENDING,
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };
}

function sourceExperiment() {
  return normalizeExperiment({
    id: 'v1', learningRootId: 'v1', learningVersion: 1, parentExperimentId: null,
    title: 'Work learning', action: '15分余白', metricKind: 'deviation', metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' }, startDateKey: '2026-06-01', targetRuns: 3,
    baselineFailureRate: 0.6, baselineSampleCount: 20, planAdjustment: { kind: 'buffer-before', minutes: 15 },
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-07-01',
    trials: [
      { recordKey: 't1', dateKey: '2026-06-01', scheduleId: 't1', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't2', dateKey: '2026-06-08', scheduleId: 't2', planTitle: 'Work', outcome: 'success' },
      { recordKey: 't3', dateKey: '2026-06-15', scheduleId: 't3', planTitle: 'Work', outcome: 'failure' },
    ],
    completedAt: '2026-06-16T00:00:00Z', createdAt: '2026-05-31T00:00:00Z',
  });
}

function retentionSummary() {
  const usages = [
    ['2026-07-06', 'a', 'failure'],
    ['2026-07-13', 'b', 'success'],
    ['2026-07-20', 'c', 'failure'],
    ['2026-07-27', 'd', 'success'],
    ['2026-08-03', 'e', 'failure'],
    ['2026-08-10', 'f', 'success'],
  ].map(([dateKey, scheduleId, outcome]) => ({ recordKey: `${dateKey}::${scheduleId}`, dateKey, scheduleId, planTitle: 'Work', outcome }));
  return {
    experimentId: 'v1', throughDateKey: '2026-08-10', reviewCandidate: true,
    assessmentCount: usages.length, weekCount: 6, failureRate: 0.5, experimentFailureRate: 1 / 3,
    differenceFromExperimentPoints: 17, usages,
  };
}

function retentionDays() {
  return {
    '2026-07-06': [recorded('a', '2026-07-06', { stress: 70, failed: true, experimentIds: ['v1'] })],
    '2026-07-13': [recorded('b', '2026-07-13', { stress: 70, failed: false, experimentIds: ['v1'] })],
    '2026-07-20': [recorded('c', '2026-07-20', { stress: 70, failed: true, experimentIds: ['v1'] })],
    '2026-07-27': [recorded('d', '2026-07-27', { stress: 70, failed: false, experimentIds: ['v1'] })],
    '2026-08-03': [recorded('e', '2026-08-03', { stress: 40, failed: true, experimentIds: ['v1'] })],
    '2026-08-10': [recorded('f', '2026-08-10', { stress: 40, failed: false, experimentIds: ['v1'] })],
  };
}

test('only plan-knowable Context Shift candidates become explicit context rules', () => {
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 70 }, '2026-08-10');
  assert.equal(rule.metric, 'target-planned-stress');
  assert.equal(rule.operator, 'gte');
  assert.equal(rule.threshold, 55);
  assert.match(contextRuleLabel(rule), /55pt以上/);
  assert.equal(contextRuleForShiftCandidate({ id: 'actual-stress', previousValue: 30, recentValue: 70 }, '2026-08-10'), null);
  assert.equal(contextRuleForShiftCandidate({ id: 'bad-mood-rate', previousValue: 0.1, recentValue: 0.5 }, '2026-08-10'), null);
});

test('day-level context rules use the whole explicit plan and ignore generated adjustment buffers', () => {
  const rule = contextRuleForShiftCandidate({ id: 'day-planned-minutes', previousValue: 120, recentValue: 300 }, '2026-08-10');
  const target = pending('target', { duration: 60 });
  const companion = { ...pending('other', { duration: 140, title: 'Other', category: '家事' }), time: '13:00' };
  const buffer = { ...pending('buffer', { duration: 30, title: '調整バッファ', category: '休憩', experimentIds: ['v1'] }), time: '08:30' };
  assert.equal(rule.threshold, 210);
  assert.equal(contextRuleMatches(rule, target, [target, companion, buffer]), false);
  assert.equal(contextRuleMatches(rule, target, [target, { ...companion, duration: 170 }, buffer]), true);
});

test('contextual baseline uses only recent normal-operation records that match the chosen condition', () => {
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 70 }, '2026-08-10');
  const baseline = buildContextualRetentionBaseline(rule, retentionSummary(), retentionDays());
  assert.equal(baseline.ok, true);
  assert.equal(baseline.count, 4);
  assert.equal(baseline.weekCount, 4);
  assert.equal(baseline.rate, 0.5);
});

test('contextual revalidation refuses a sparse contextual baseline', () => {
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 90 }, '2026-08-10');
  const baseline = buildContextualRetentionBaseline(rule, retentionSummary(), retentionDays());
  assert.equal(baseline.ok, false);
  assert.ok(baseline.count < 4);
});

test('a revalidation version persists one context rule and uses the matching contextual baseline', () => {
  const source = sourceExperiment();
  const summary = retentionSummary();
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 70 }, summary.throughDateKey);
  const baseline = buildContextualRetentionBaseline(rule, summary, retentionDays());
  const v2 = createRevalidationExperiment(source, summary, {
    id: 'v2', startDateKey: '2026-08-11', learningVersion: 2, action: '30分余白',
    planAdjustment: { kind: 'buffer-before', minutes: 30 }, contextRule: rule, contextBaseline: baseline,
  });
  assert.equal(v2.learningVersion, 2);
  assert.deepEqual(v2.contextRule, rule);
  assert.equal(v2.baselineFailureRate, 0.5);
  assert.equal(v2.baselineSampleCount, 4);
});

test('conditional experiments and adopted feedback exclude base-condition records outside the context rule', () => {
  const source = sourceExperiment();
  const summary = retentionSummary();
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 70 }, summary.throughDateKey);
  const baseline = buildContextualRetentionBaseline(rule, summary, retentionDays());
  const active = createRevalidationExperiment(source, summary, {
    id: 'v2', startDateKey: '2026-08-11', learningVersion: 2, contextRule: rule, contextBaseline: baseline,
  });
  const days = {
    '2026-08-17': [recorded('high', '2026-08-17', { stress: 70 }), recorded('low', '2026-08-17', { stress: 40 })],
  };
  const eligible = listEligibleExperimentRecords(active, days, '2026-08-17');
  assert.deepEqual(eligible.map((item) => item.scheduleId), ['high']);

  const adopted = normalizeExperiment({
    ...active,
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-08-18',
    trials: [
      { recordKey: 'x', dateKey: '2026-08-11', scheduleId: 'x', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'y', dateKey: '2026-08-12', scheduleId: 'y', planTitle: 'Work', outcome: 'success' },
      { recordKey: 'z', dateKey: '2026-08-13', scheduleId: 'z', planTitle: 'Work', outcome: 'success' },
    ],
    completedAt: '2026-08-18T00:00:00Z',
  });
  const suggestions = buildPlanFeedbackSuggestions(adopted ? [adopted] : [], '2026-08-24', [pending('future-high', { stress: 70 }), pending('future-low', { stress: 40 })]);
  assert.deepEqual(suggestions.map((item) => item.scheduleId), ['future-high']);
  assert.match(suggestions[0].preview.contextRuleLabel, /55pt以上/);
});

test('backup rejects malformed context rules instead of silently broadening a conditional learning', () => {
  const source = sourceExperiment();
  const summary = retentionSummary();
  const rule = contextRuleForShiftCandidate({ id: 'target-planned-stress', previousValue: 40, recentValue: 70 }, summary.throughDateKey);
  const baseline = buildContextualRetentionBaseline(rule, summary, retentionDays());
  const child = createRevalidationExperiment(source, summary, {
    id: 'v2', startDateKey: '2026-08-11', learningVersion: 2, contextRule: rule, contextBaseline: baseline,
  });
  const text = serializeBackup({ store: { version: 2, days: {} }, templates: [], experiments: [source, child], reminderPreferences: {} });
  const payload = JSON.parse(text);
  payload.experiments[1].contextRule.threshold = 'broken';
  const parsed = parseBackup(JSON.stringify(payload));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});
