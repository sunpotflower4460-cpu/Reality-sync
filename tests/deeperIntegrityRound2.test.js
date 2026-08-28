import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_STORAGE_VERSION, STATUS, STORAGE_VERSION } from '../src/constants.js';
import { parseStoredExperimentsForPersistence } from '../src/utils/experimentStorage.js';
import { calculateStats, normalizeSchedule } from '../src/utils/schedule.js';
import { parseStoredScheduleStoreResult } from '../src/utils/storage.js';

function storedSchedule(overrides = {}) {
  return {
    id: 'recorded-1',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: {
      time: '09:00',
      title: 'Work',
      category: '仕事',
      duration: 60,
      plannedStress: 40,
    },
    actualTitle: 'Work',
    actualCategory: '仕事',
    actualDuration: 60,
    ...overrides,
  };
}

function rawExperiment(overrides = {}) {
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

function parseExperiment(experiment, payloadOverrides = {}) {
  return parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: [experiment],
    ...payloadOverrides,
  }));
}

test('schedule store rejects unknown top-level metadata instead of erasing it on the next save', () => {
  const raw = JSON.stringify({
    version: STORAGE_VERSION,
    days: { '2026-08-28': [storedSchedule()] },
    futureMetadata: { source: 'newer-client' },
  });
  assert.equal(parseStoredScheduleStoreResult(raw).ok, false);
});

test('recorded plan snapshot rejects unknown nested facts instead of silently shrinking history', () => {
  const schedule = storedSchedule();
  schedule.plannedSnapshot.futureFact = 'keep-me';
  const raw = JSON.stringify({
    version: STORAGE_VERSION,
    days: { '2026-08-28': [schedule] },
  });
  assert.equal(parseStoredScheduleStoreResult(raw).ok, false);
});

test('changed reality with an unrecorded category stays unknown rather than becoming その他', () => {
  const normalized = normalizeSchedule({
    id: 'changed-legacy',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 40,
    status: STATUS.CHANGED,
    actualTitle: 'Something else',
    actualDuration: 35,
  });

  assert.equal(normalized.actualCategory, null);
  const stats = calculateStats([normalized]);
  assert.equal(stats.categories['未分類'].actual, 35);
  assert.equal(stats.categories['その他'], undefined);
});

test('experiment storage rejects unknown payload and experiment fields instead of erasing newer protocol data', () => {
  assert.equal(parseExperiment(rawExperiment(), { futureMetadata: true }).ok, false);
  assert.equal(parseExperiment(rawExperiment({ futureProtocolField: 'keep-me' })).ok, false);
});

test('experiment storage rejects unknown nested trial and condition fields', () => {
  const unknownCondition = rawExperiment({
    condition: { kind: 'weekday', value: 0, futureConstraint: 'keep-me' },
  });
  const unknownTrial = rawExperiment({
    trials: [{
      id: 'trial-1',
      recordKey: '2026-08-28::work',
      dateKey: '2026-08-28',
      scheduleId: 'work',
      planTitle: 'Work',
      outcome: 'success',
      observedValue: 0,
      observedLabel: '予定通り',
      capturedAt: '2026-08-28T00:00:00Z',
      futureObservation: 'keep-me',
    }],
  });

  assert.equal(parseExperiment(unknownCondition).ok, false);
  assert.equal(parseExperiment(unknownTrial).ok, false);
});
