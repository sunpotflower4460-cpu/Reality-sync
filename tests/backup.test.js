import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { parseBackup, serializeBackup } from '../src/utils/backup.js';

test('backup round-trip preserves normalized product data and reports a summary', () => {
  const text = serializeBackup({
    store: {
      version: 2,
      days: {
        '2026-08-23': [{
          id: 'work', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40,
          status: STATUS.AS_PLANNED, actualTitle: 'Work', actualCategory: '仕事', actualDuration: 55,
          actualStartTime: '09:10', actualStartDateKey: '2026-08-23', actualStress: 35, mood: 'good',
        }],
      },
    },
    templates: [{ id: 'weekday', name: '平日', schedules: [{ time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40, actualDuration: 999 }] }],
    experiments: [{
      id: 'exp', candidateId: 'weekday-outcome-0', candidateType: 'weekday-outcome', title: 'Monday', hypothesis: 'buffer', action: '15分余白',
      metricKind: 'deviation', metricLabel: '変更・スキップ', condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3,
      baselineFailureRate: 0.5, baselineSampleCount: 8, status: 'active', trials: [],
    }],
    reminderPreferences: { enabled: true, delayMinutes: 30, browserNotifications: true },
    exportedAt: '2026-08-23T12:00:00.000Z',
  });

  const parsed = parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.summary.dayCount, 1);
  assert.equal(parsed.summary.scheduleCount, 1);
  assert.equal(parsed.summary.templateCount, 1);
  assert.equal(parsed.summary.experimentCount, 1);
  assert.equal(parsed.data.scheduleStore.days['2026-08-23'][0].actualStartDateKey, '2026-08-23');
  assert.equal(parsed.data.templates[0].schedules[0].actualDuration, undefined);
  assert.equal(parsed.data.experiments[0].id, 'exp');
  assert.deepEqual(parsed.data.reminderPreferences, { enabled: true, delayMinutes: 30, browserNotifications: true });
});

test('structured adopted experiment metadata survives backup round-trip', () => {
  const text = serializeBackup({
    store: { version: 2, days: {} },
    templates: [],
    experiments: [{
      id: 'adopted', title: 'Monday buffer', action: '余白を置く', metricKind: 'deviation', metricLabel: '変更',
      condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3,
      baselineFailureRate: 0.7, baselineSampleCount: 10,
      planAdjustment: { kind: 'buffer-before', minutes: 15 },
      status: 'completed', decision: 'adopt', decisionDateKey: '2026-09-01', completedAt: '2026-09-01T15:00:00Z',
      trials: [
        { id: 'trial-a', recordKey: '2026-08-24::a', dateKey: '2026-08-24', scheduleId: 'a', planTitle: 'A', outcome: 'success', observedValue: 0, observedLabel: '予定通り', capturedAt: '2026-08-24T12:00:00Z' },
        { id: 'trial-b', recordKey: '2026-08-31::b', dateKey: '2026-08-31', scheduleId: 'b', planTitle: 'B', outcome: 'success', observedValue: 0, observedLabel: '予定通り', capturedAt: '2026-08-31T12:00:00Z' },
        { id: 'trial-c', recordKey: '2026-08-31::c', dateKey: '2026-08-31', scheduleId: 'c', planTitle: 'C', outcome: 'failure', observedValue: 1, observedLabel: '変更・スキップ', capturedAt: '2026-08-31T13:00:00Z' },
      ],
    }],
    reminderPreferences: {},
  });
  const parsed = parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.experiments[0].planAdjustment, { kind: 'buffer-before', minutes: 15 });
  assert.equal(parsed.data.experiments[0].decisionDateKey, '2026-09-01');
});

test('backup preserves orphaned applied-experiment markers from older app versions but rejects contradictory live provenance', () => {
  const base = {
    format: 'reality-sync-backup',
    version: 1,
    scheduleStore: {
      version: 2,
      days: {
        '2026-09-02': [{
          id: 'plan', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40,
          appliedExperimentIds: ['exp-source'], status: STATUS.PENDING,
        }],
      },
    },
    templates: [],
    reminderPreferences: { enabled: true, delayMinutes: 15, browserNotifications: false },
  };

  const missing = parseBackup(JSON.stringify({ ...base, experiments: [] }));
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.data.scheduleStore.days['2026-09-02'][0].appliedExperimentIds, ['exp-source']);

  const active = parseBackup(JSON.stringify({
    ...base,
    experiments: [{
      id: 'exp-source', title: 'Test', action: '余白', metricKind: 'deviation', metricLabel: '変更',
      condition: { kind: 'weekday', value: 2 }, startDateKey: '2026-09-02', targetRuns: 3,
      baselineFailureRate: 0.5, baselineSampleCount: 8, status: 'active', trials: [],
    }],
  }));
  assert.equal(active.ok, false);
  assert.match(active.error, /適用済みの学習/);
});

test('backup preserves legacy orphaned template markers without inventing missing experiment details', () => {
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup',
    version: 1,
    scheduleStore: { version: 2, days: {} },
    templates: [{
      id: 'template',
      name: 'Saved plan',
      schedules: [{
        time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40,
        appliedExperimentIds: ['missing-adopted-experiment'],
      }],
    }],
    experiments: [],
    reminderPreferences: { enabled: true, delayMinutes: 15, browserNotifications: false },
  }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.templates[0].schedules[0].appliedExperimentIds, ['missing-adopted-experiment']);
});

test('older v1 backups without experiment history remain readable as an empty experiment list', () => {
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1, exportedAt: '2026-08-23T00:00:00Z',
    scheduleStore: { version: 2, days: { '2026-08-23': [] } }, templates: [], reminderPreferences: {},
  }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.experiments, []);
  assert.equal(parsed.summary.experimentCount, 0);
});

test('backup parser rejects an experiment whose trial would be silently lost during normalization', () => {
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1,
    scheduleStore: { version: 2, days: {} }, templates: [], reminderPreferences: {},
    experiments: [{
      id: 'exp', title: 'Monday', action: '余白', metricKind: 'deviation', metricLabel: '変更',
      condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3, status: 'active',
      trials: [{ recordKey: 'bad', dateKey: 'not-a-date', outcome: 'success' }],
    }],
  }));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});

test('backup parser rejects invalid structured experiment metadata instead of silently dropping it', () => {
  const base = {
    format: 'reality-sync-backup', version: 1,
    scheduleStore: { version: 2, days: {} }, templates: [], reminderPreferences: {},
  };
  const invalidAdjustment = parseBackup(JSON.stringify({
    ...base,
    experiments: [{
      id: 'exp', title: 'Test', action: '余白', metricKind: 'deviation', condition: { kind: 'weekday', value: 0 },
      startDateKey: '2026-08-24', targetRuns: 3, status: 'completed', decision: 'adopt', decisionDateKey: '2026-09-01',
      planAdjustment: { kind: 'not-supported', minutes: 15 }, trials: [],
    }],
  }));
  assert.equal(invalidAdjustment.ok, false);
  assert.match(invalidAdjustment.error, /実験履歴/);

  const invalidDecisionDate = parseBackup(JSON.stringify({
    ...base,
    experiments: [{
      id: 'exp', title: 'Test', action: '余白', metricKind: 'deviation', condition: { kind: 'weekday', value: 0 },
      startDateKey: '2026-08-24', targetRuns: 3, status: 'completed', decision: 'adopt', decisionDateKey: '2026-02-30',
      planAdjustment: { kind: 'buffer-before', minutes: 15 }, trials: [],
    }],
  }));
  assert.equal(invalidDecisionDate.ok, false);
  assert.match(invalidDecisionDate.error, /実験履歴/);
});

test('backup parser rejects malformed, foreign and future backup formats', () => {
  assert.equal(parseBackup('{broken').ok, false);
  assert.equal(parseBackup(JSON.stringify({ format: 'other-app', version: 1 })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ format: 'reality-sync-backup', version: 99, scheduleStore: { version: 2, days: {} } })).ok, false);
});

test('backup parser rejects a future schedule storage version instead of coercing it', () => {
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1,
    scheduleStore: { version: 3, days: { '2026-08-23': [] } }, templates: [], reminderPreferences: {},
  }));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /保存バージョン/);
});
