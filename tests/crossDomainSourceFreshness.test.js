import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('schedule source resolver preflights device storage and requires the exact reviewed day revision', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  const start = hook.indexOf('const resolveSchedulesForMutation');
  const end = hook.indexOf('const clearDay', start);
  const block = hook.slice(start, end);
  assert.match(block, /const currentState = latestStateBeforeMutation\(\)/);
  assert.match(block, /const latestDay = currentState\.store\.days\[dateKey\] \?\? \[\]/);
  assert.match(block, /dayRevision\(latestDay\) === expectedRevision/);
  assert.match(block, /return revisionMatches \? latestDay : null/);
});

test('template source resolver preflights device storage and requires the exact reviewed revision', () => {
  const hook = source('src/hooks/useScheduleTemplates.js');
  const start = hook.indexOf('const resolveTemplateForMutation');
  const end = hook.indexOf('const replaceTemplates', start);
  const block = hook.slice(start, end);
  assert.match(block, /const current = latestStateBeforeMutation\(\)/);
  assert.match(block, /current\.templates\.find\(\(item\) => item\.id === templateId\)/);
  assert.match(block, /JSON\.stringify\(template\) === expectedRevision/);
  assert.match(block, /return revisionMatches \? template : null/);
});

test('experiment source resolver preflights device storage and requires the exact reviewed revision', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const resolveExperimentForMutation');
  const end = hook.indexOf('const replaceExperiments', start);
  const block = hook.slice(start, end);
  assert.match(block, /const current = latestStateBeforeMutation\(\)/);
  assert.match(block, /current\.experiments\.find\(\(item\) => item\.id === experimentId\)/);
  assert.match(block, /JSON\.stringify\(experiment\) === expectedRevision/);
  assert.match(block, /return revisionMatches \? experiment : null/);
});

test('cross-domain planning writes resolve source freshness before mutating another domain', () => {
  const app = source('src/App.jsx');
  const saveTemplateBlock = app.slice(app.indexOf('const saveCurrentDayAsTemplate'), app.indexOf('const applyTemplate'));
  const templateBlock = app.slice(app.indexOf('const applyTemplate'), app.indexOf('const applySelectedPlanFeedback'));
  const feedbackBlock = app.slice(app.indexOf('const applySelectedPlanFeedback'), app.indexOf('const restoreBackup'));
  assert.match(saveTemplateBlock, /resolveSchedulesForMutation\(dayRevisionKey\(schedules\)\)/);
  assert.match(saveTemplateBlock, /saveTemplate\(name, sourceSchedules\)/);
  assert.match(templateBlock, /resolveTemplateForMutation\(template\.id, templateRevision\)/);
  assert.match(templateBlock, /if \(!latestTemplate\) return false;/);
  assert.match(feedbackBlock, /resolveExperimentForMutation\(/);
  assert.match(feedbackBlock, /if \(!experiment\)/);
});
