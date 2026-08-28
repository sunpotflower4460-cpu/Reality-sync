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

function versioned(schedule) {
  return JSON.stringify({ version: 2, days: { '2026-08-23': [schedule] } });
}

test('versioned schedule storage rejects numeric strings instead of silently changing fact types', () => {
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ duration: '60' }))).ok, false);
  assert.equal(parseStoredScheduleStoreResult(versioned(pending({ plannedStress: '40' }))).ok, false);

  const recorded = pending({
    status: STATUS.AS_PLANNED,
    plannedSnapshot: { time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: '40' },
    actualTitle: 'Focus',
    actualCategory: '仕事',
    actualDuration: '45',
    actualStress: '30',
  });
  assert.equal(parseStoredScheduleStoreResult(versioned(recorded)).ok, false);
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
