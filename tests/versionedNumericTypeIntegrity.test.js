import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
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

test('legacy schedule migration remains permissive for numeric strings and canonicalizes them once', () => {
  const raw = JSON.stringify([pending({ duration: '60', plannedStress: '40' })]);
  const result = migrateLegacySchedulesResult(raw, '2026-08-23', []);
  assert.equal(result.ok, true);
  assert.equal(result.store.days['2026-08-23'][0].duration, 60);
  assert.equal(result.store.days['2026-08-23'][0].plannedStress, 40);
});

test('stored templates reject numeric strings instead of rewriting their schema types', () => {
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
  assert.equal(parseStoredTemplatesResult(durationString).ok, false);
  assert.equal(parseStoredTemplatesResult(stressString).ok, false);
});
