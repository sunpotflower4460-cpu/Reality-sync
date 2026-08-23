import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup, serializeBackup } from '../src/utils/backup.js';

function sourceExperiment() {
  return {
    id: 'v1', title: 'Monday buffer', action: '15分余白', metricKind: 'deviation', metricLabel: '変更',
    condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3,
    baselineFailureRate: 0.7, baselineSampleCount: 10,
    planAdjustment: { kind: 'buffer-before', minutes: 15 },
    learningRootId: 'v1', parentExperimentId: null, learningVersion: 1, revalidationReason: '', sourceRetention: null,
    status: 'completed', decision: 'adopt', decisionDateKey: '2026-09-01', completedAt: '2026-08-31T15:00:00Z',
    trials: [
      { recordKey: 'a', dateKey: '2026-08-24', scheduleId: 'a', planTitle: 'A', outcome: 'success' },
      { recordKey: 'b', dateKey: '2026-08-31', scheduleId: 'b', planTitle: 'B', outcome: 'success' },
      { recordKey: 'c', dateKey: '2026-08-31', scheduleId: 'c', planTitle: 'C', outcome: 'failure' },
    ],
  };
}

function childExperiment() {
  return {
    id: 'v2', title: 'Monday buffer', action: '30分余白', metricKind: 'deviation', metricLabel: '変更',
    condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-10-06', targetRuns: 3,
    baselineFailureRate: 0.6, baselineSampleCount: 10,
    planAdjustment: { kind: 'buffer-before', minutes: 30 },
    learningRootId: 'v1', parentExperimentId: 'v1', learningVersion: 2,
    revalidationReason: '通常運用で実験中より+27ptの悪化を観測したため再検証',
    sourceRetention: {
      experimentId: 'v1', throughDateKey: '2026-10-05', assessmentCount: 10, weekCount: 4,
      failureRate: 0.6, experimentFailureRate: 1 / 3, differenceFromExperimentPoints: 27,
      capturedAt: '2026-10-05T10:00:00Z',
    },
    status: 'active', decision: null, decisionDateKey: null, trials: [], createdAt: '2026-10-05T10:00:00Z',
  };
}

function base(experiments) {
  return {
    store: { version: 2, days: {} },
    templates: [],
    experiments,
    reminderPreferences: {},
  };
}

test('backup round-trip preserves parent/root/version and retention source snapshot', () => {
  const parsed = parseBackup(serializeBackup(base([sourceExperiment(), childExperiment()])));
  assert.equal(parsed.ok, true);
  const child = parsed.data.experiments.find((experiment) => experiment.id === 'v2');
  assert.equal(child.parentExperimentId, 'v1');
  assert.equal(child.learningRootId, 'v1');
  assert.equal(child.learningVersion, 2);
  assert.equal(child.sourceRetention.throughDateKey, '2026-10-05');
  assert.equal(child.sourceRetention.assessmentCount, 10);
});

test('backup rejects a child whose parent is missing instead of silently orphaning the lineage', () => {
  const text = serializeBackup(base([childExperiment()]));
  const parsed = parseBackup(text);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});

test('backup rejects malformed revalidation source metadata instead of dropping it', () => {
  const source = sourceExperiment();
  const child = childExperiment();
  child.sourceRetention = { ...child.sourceRetention, throughDateKey: 'not-a-date' };
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1,
    scheduleStore: { version: 2, days: {} }, templates: [], reminderPreferences: {}, experiments: [source, child],
  }));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});

test('backup rejects a lineage version that does not advance beyond its parent', () => {
  const source = sourceExperiment();
  const child = { ...childExperiment(), learningVersion: 1 };
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1,
    scheduleStore: { version: 2, days: {} }, templates: [], reminderPreferences: {}, experiments: [source, child],
  }));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});
