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

test('older v1 backups without experiment history remain readable as an empty experiment list', () => {
  const parsed = parseBackup(JSON.stringify({
    format: 'reality-sync-backup', version: 1, exportedAt: '2026-08-23T00:00:00Z',
    scheduleStore: { version: 2, days: { '2026-08-23': [] } }, templates: [], reminderPreferences: {},
  }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.experiments, []);
  assert.equal(parsed.summary.experimentCount, 0);
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
