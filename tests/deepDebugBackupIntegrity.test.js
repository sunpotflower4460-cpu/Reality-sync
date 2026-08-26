import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from '../src/utils/backup.js';

function backup(overrides = {}) {
  return {
    format: 'reality-sync-backup',
    version: 1,
    scheduleStore: { version: 2, days: {} },
    templates: [],
    experiments: [],
    reminderPreferences: {},
    ...overrides,
  };
}

test('backup restore rejects partial template loss instead of restoring a shortened template', () => {
  const parsed = parseBackup(JSON.stringify(backup({
    templates: [{
      id: 'template-1',
      name: 'Mixed',
      schedules: [
        { time: '09:00', title: 'Valid', category: '仕事', duration: 60, plannedStress: 40 },
        { time: '10:00', title: 'Broken', category: '仕事', duration: null, plannedStress: 30 },
      ],
    }],
  })));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /テンプレート/);
});

test('backup restore rejects malformed learned-plan markers instead of broadening a template', () => {
  const parsed = parseBackup(JSON.stringify(backup({
    templates: [{
      id: 'template-1',
      name: 'Learned plan',
      schedules: [{
        time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 40,
        appliedExperimentIds: ['exp-a', 'exp-a'],
      }],
    }],
  })));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /テンプレート/);
});

test('backup restore rejects malformed explicit trial values instead of turning them unknown', () => {
  const parsed = parseBackup(JSON.stringify(backup({
    experiments: [{
      id: 'exp', title: 'Test', action: '余白', metricKind: 'deviation', metricLabel: '変更',
      condition: { kind: 'weekday', value: 0 }, startDateKey: '2026-08-24', targetRuns: 3,
      status: 'active',
      trials: [{
        recordKey: '2026-08-24::work', dateKey: '2026-08-24', scheduleId: 'work',
        planTitle: 'Work', outcome: 'success', observedValue: 'broken', observedLabel: '予定通り',
      }],
    }],
  })));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /実験履歴/);
});

test('backup restore rejects malformed explicit reminder settings instead of silently restoring defaults', () => {
  const badDelay = parseBackup(JSON.stringify(backup({ reminderPreferences: { delayMinutes: null } })));
  const badToggle = parseBackup(JSON.stringify(backup({ reminderPreferences: { enabled: 'yes' } })));
  assert.equal(badDelay.ok, false);
  assert.match(badDelay.error, /リマインダー/);
  assert.equal(badToggle.ok, false);
  assert.match(badToggle.error, /リマインダー/);
});

test('older backups may omit individual reminder fields and still inherit documented defaults', () => {
  const parsed = parseBackup(JSON.stringify(backup({ reminderPreferences: {} })));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.reminderPreferences, {
    enabled: true,
    delayMinutes: 15,
    browserNotifications: false,
  });
});
