import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { createTemplateFromSchedules, normalizeTemplates, parseStoredTemplates } from '../src/utils/template.js';

test('template creation stores plan fields only and strips recorded reality', () => {
  const template = createTemplateFromSchedules(' 平日 ', [{
    id: 'old',
    time: '09:00',
    title: 'Work',
    category: '仕事',
    duration: 60,
    plannedStress: 50,
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
    schedules: [{ time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50 }],
  });
});

test('template parser rejects malformed or empty templates', () => {
  assert.deepEqual(parseStoredTemplates('{bad-json'), []);
  assert.deepEqual(normalizeTemplates([
    { id: 'empty-name', name: '   ', schedules: [{ time: '09:00', title: 'A' }] },
    { id: 'empty-list', name: 'Empty', schedules: [] },
  ]), []);
});

test('template normalization deduplicates ids and sanitizes plan fields', () => {
  const templates = normalizeTemplates([
    { id: 'same', name: 'First', schedules: [{ time: '25:00', title: '  Focus  ', category: '__proto__', duration: 9999, plannedStress: -5 }] },
    { id: 'same', name: 'Second', schedules: [{ time: '10:00', title: 'Other', category: '仕事', duration: 30, plannedStress: 20 }] },
  ]);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].name, 'First');
  assert.deepEqual(templates[0].schedules[0], { time: '00:00', title: 'Focus', category: 'その他', duration: 1440, plannedStress: 0 });
});
