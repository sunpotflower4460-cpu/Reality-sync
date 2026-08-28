import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_FORMAT, BACKUP_VERSION, STATUS } from '../src/constants.js';
import { parseBackup } from '../src/utils/backup.js';
import { migrateLegacySchedulesResult, parseStoredScheduleStoreResult } from '../src/utils/storage.js';
import { parseStoredTemplatesResult } from '../src/utils/template.js';

function pending(overrides = {}) {
  return {
    id: 'plan-1',
    time: '09:00',
    title: 'Focus',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.PENDING,
    ...overrides,
  };
}

function asPlanned(overrides = {}) {
  return pending({
    status: STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 40 },
    actualTitle: 'Focus',
    actualCategory: '仕事',
    actualDuration: 45,
    actualStartTime: '09:05',
    actualStartDateKey: '2026-08-23',
    deviationReason: null,
    mood: null,
    actualStress: null,
    ...overrides,
  });
}

function versioned(schedule) {
  return JSON.stringify({ version: 2, days: { '2026-08-23': [schedule] } });
}

function backupWithExperiment(experiment) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-08-28T00:00:00.000Z',
    scheduleStore: { version: 2, days: {} },
    templates: [],
    experiments: [experiment],
    reminderPreferences: { enabled: true, delayMinutes: 15, browserNotifications: false },
  });
}

function activeExperiment(overrides = {}) {
  return {
    id: 'exp-1',
    title: 'Monday buffer',
    action: '15分余白',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'weekday', value: 0 },
    startDateKey: '2026-08-24',
    targetRuns: 3,
    baselineFailureRate: 0.5,
    baselineSampleCount: 10,
    status: 'active',
    trials: [],
    ...overrides,
  };
}

test('versioned schedule storage rejects numeric strings instead of silently changing fact types', () => {
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ duration: '60' }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ plannedStress: '40' }))).ok, false);

  const recorded = asPlanned({
    plannedSnapshot: { time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: '40' },
    actualDuration: '45',
    actualStress: '30',
  });
  assert.equal(parseStoredScheduleStoreResult(versioned(recorded)).ok, false);
});

test('current plan facts reject fractional values the editor and automatic adjustments cannot create', () => {
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ duration: 60.5 }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ plannedStress: 40.5 }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({
    plannedSnapshot: { time: '09:00', title: 'Focus', category: '仕事', duration: 60.5, plannedStress: 40 },
  }))).ok, false);

  const fractionalActual = parseStoredScheduleStoreResult(versioned(asPlanned({
    actualDuration: 45.5,
    actualStress: 30.5,
  })));
  assert.equal(fractionalActual.ok, true, 'optional observed values remain numeric measurements, not plan-grid integers');
});

test('versioned recorded facts reject explicit empty or null values that normalization would replace', () => {
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ actualTitle: '' }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ actualCategory: null }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ actualDuration: '' }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ actualStartTime: '', actualStartDateKey: null }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ deviationReason: '' }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(asPlanned({ mood: '' }))).ok, false);
});

test('legitimate pending null/empty sentinel fields still round-trip in the versioned schema', () => {
  const result = parseStoredScheduleStoreResult(versioned(pending({
    appliedExperimentIds: [],
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  })));
  assert.equal(result.ok, true);
  assert.equal(result.store.days['2026-08-23'][0].status, STATUS.PENDING);
});

test('missing legacy-v2 optional record fields remain compatible while explicit contradictory values are protected', () => {
  const oldV2Record = pending({
    status: STATUS.AS_PLANNED,
    actualDuration: 45,
  });
  const result = parseStoredScheduleStoreResult(versioned(oldV2Record));
  assert.equal(result.ok, true);
  assert.equal(result.store.days['2026-08-23'][0].actualTitle, 'Focus');
  assert.equal(result.store.days['2026-08-23'][0].actualCategory, '仕事');
});

test('legacy schedule migration remains permissive for numeric strings and fractional plan values and canonicalizes known fields once', () => {
  const raw = JSON.stringify([pending({ duration: '60', plannedStress: '40' })]);
  const result = migrateLegacySchedulesResult(raw, '2026-08-23', []);
  assert.equal(result.ok, true);
  assert.equal(result.store.days['2026-08-23'][0].duration, 60);
  assert.equal(result.store.days['2026-08-23'][0].plannedStress, 40);

  const fractional = migrateLegacySchedulesResult(JSON.stringify([
    pending({ id: 'legacy-fractional', duration: 60.5, plannedStress: 40.5 }),
  ]), '2026-08-23', []);
  assert.equal(fractional.ok, true);
  assert.equal(fractional.store.days['2026-08-23'][0].duration, 60.5);
  assert.equal(fractional.store.days['2026-08-23'][0].plannedStress, 40.5);
});

test('stored templates reject numeric strings and fractional plan facts instead of rewriting or accepting off-grid values', () => {
  const durationString = JSON.stringify([{
    id: 'template-1',
    name: 'Focus day',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: '60', plannedStress: 40 }],
  }]);
  const stressString = JSON.stringify([{
    id: 'template-2',
    name: 'Focus day',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: '40' }],
  }]);
  const durationFraction = JSON.stringify([{
    id: 'template-3',
    name: 'Focus day',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: 60.5, plannedStress: 40 }],
  }]);
  const stressFraction = JSON.stringify([{
    id: 'template-4',
    name: 'Focus day',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 40.5 }],
  }]);
  assert.equal(parseStoredTemplatesResult(durationString).ok, false);
  assert.equal(parseStoredTemplatesResult(stressString).ok, false);
  assert.equal(parseStoredTemplatesResult(durationFraction).ok, false);
  assert.equal(parseStoredTemplatesResult(stressFraction).ok, false);
});

test('current backup format cannot bypass strict experiment numeric types through the legacy array parser', () => {
  assert.equal(parseBackup(backupWithExperiment(activeExperiment({ targetRuns: '3' }))).ok, false);
  assert.equal(parseBackup(backupWithExperiment(activeExperiment({ baselineFailureRate: '0.5' }))).ok, false);
  assert.equal(parseBackup(backupWithExperiment(activeExperiment({ baselineSampleCount: '10' }))).ok, false);
});
