import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import {
  createTemplateFromSchedules,
  normalizeTemplates,
  parseStoredTemplates,
  parseStoredTemplatesResult,
} from '../src/utils/template.js';

test('template creation stores plan fields only, strips recorded reality, and preserves adopted learning already baked into the plan', () => {
  const template = createTemplateFromSchedules(' 平日 ', [{
    id: 'old',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
    appliedExperimentIds: ['exp-a', 'exp-a', '  exp-b  '],
    status: STATUS.CHANGED,
    actualTitle: 'Nap',
    actualCategory: '休憩',
    actualDuration: 30,
    actualStartTime: '09:20',
    deviationReason: 'tired',
  }], 'template-1');

  assert.deepEqual(template, {
    id: 'template-1',
    name: '平日',
    schedules: [{ time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, appliedExperimentIds: ['exp-a', 'exp-b'] }],
  });
});

test('template parser reports malformed storage so it cannot be silently overwritten', () => {
  assert.deepEqual(parseStoredTemplates('{bad-json'), []);
  assert.equal(parseStoredTemplatesResult('{bad-json').ok, false);
  assert.equal(parseStoredTemplatesResult(JSON.stringify({ templates: [] })).ok, false);
});

test('template parser blocks malformed schedule rows instead of fabricating defaults', () => {
  const raw = JSON.stringify([{
    id: 'bad-template',
    name: 'Broken',
    schedules: [{ time: '25:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 20 }],
  }]);
  const result = parseStoredTemplatesResult(raw);
  assert.equal(result.ok, false);
  assert.deepEqual(result.templates, []);
});

test('template parser keeps missing numeric plan facts invalid instead of coercing null to zero', () => {
  const nullDuration = JSON.stringify([{
    id: 'bad-duration',
    name: 'Broken duration',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: null, plannedStress: 20 }],
  }]);
  const nullStress = JSON.stringify([{
    id: 'bad-stress',
    name: 'Broken stress',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: null }],
  }]);
  assert.equal(parseStoredTemplatesResult(nullDuration).ok, false);
  assert.equal(parseStoredTemplatesResult(nullStress).ok, false);
});

test('template parser protects explicit learned-plan markers instead of silently dropping malformed ids', () => {
  const malformedIds = JSON.stringify([{
    id: 'bad-ids',
    name: 'Broken ids',
    schedules: [{
      time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 20,
      appliedExperimentIds: ['exp-a', 'exp-a'],
    }],
  }]);
  const nonArrayIds = JSON.stringify([{
    id: 'bad-id-shape',
    name: 'Broken id shape',
    schedules: [{
      time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 20,
      appliedExperimentIds: 'exp-a',
    }],
  }]);
  assert.equal(parseStoredTemplatesResult(malformedIds).ok, false);
  assert.equal(parseStoredTemplatesResult(nonArrayIds).ok, false);
});

test('template parser refuses to invent a stored template id', () => {
  const raw = JSON.stringify([{
    name: 'No id',
    schedules: [{ time: '09:00', title: 'Focus', category: '仕事', duration: 60, plannedStress: 20 }],
  }]);
  assert.equal(parseStoredTemplatesResult(raw).ok, false);
});

test('template normalization rejects malformed plan rows and still deduplicates valid ids', () => {
  const templates = normalizeTemplates([
    { id: 'same', name: 'Broken first', schedules: [{ time: '25:00', title: 'Focus', category: '__proto__', duration: 9999, plannedStress: -5 }] },
    { id: 'same', name: 'Valid', schedules: [{ time: '10:00', title: 'Other', category: '仕事', duration: 30, plannedStress: 20 }] },
    { id: 'same', name: 'Duplicate valid', schedules: [{ time: '11:00', title: 'Other 2', category: '仕事', duration: 20, plannedStress: 10 }] },
  ]);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].name, 'Valid');
  assert.deepEqual(templates[0].schedules[0], { time: '10:00', title: 'Other', category: '仕事', duration: 30, plannedStress: 20, appliedExperimentIds: [] });
});

test('valid stored templates round-trip without protection mode', () => {
  const raw = JSON.stringify([{
    id: 'template-1',
    name: '平日',
    schedules: [{ time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50, appliedExperimentIds: [] }],
  }]);
  const result = parseStoredTemplatesResult(raw);
  assert.equal(result.ok, true);
  assert.equal(result.templates.length, 1);
  assert.equal(result.templates[0].name, '平日');
});
