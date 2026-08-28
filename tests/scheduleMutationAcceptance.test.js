import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('schedule mutations preflight the latest device store and synchronously report acceptance', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  assert.match(hook, /const stateRef = useRef\(state\)/);
  assert.match(hook, /const applyState = useCallback\(\(updater\) =>/);
  assert.match(hook, /stateRef\.current = next;\s*setState\(next\);/s);
  assert.match(hook, /const latestStateBeforeMutation = useCallback/);
  assert.match(hook, /parseStoredScheduleStoreResult\(window\.localStorage\.getItem\(STORAGE_KEY\)\)/);
  assert.match(hook, /mergeScheduleStoreWrite\(\s*latest\.store,\s*current\.store,\s*current\.dirtyDateKeys,\s*current\.baseDays/s);
  assert.match(hook, /const currentState = latestStateBeforeMutation\(\)/);
  assert.match(hook, /if \(!currentState\) return false;/);
  assert.match(hook, /applyState\(nextState\);\s*return true;/s);
});

test('record and plan editors recheck their opening revision inside the atomic day updater', () => {
  const app = source('src/App.jsx');
  const saveRecord = app.slice(app.indexOf('const saveRecord'), app.indexOf('const saveSchedule'));
  const saveSchedule = app.slice(app.indexOf('const saveSchedule'), app.indexOf('const deleteSchedule'));
  const deleteSchedule = app.slice(app.indexOf('const deleteSchedule'), app.indexOf('const confirmReplaceDay'));
  assert.match(saveRecord, /const accepted = setSchedules\(\(current\) =>/);
  assert.match(saveRecord, /scheduleRevisionKey\(currentSchedule\) !== recordSession\.baseRevision/);
  assert.match(saveRecord, /if \(!accepted\) return false;\s*setRecordSession\(null\)/s);
  assert.match(saveSchedule, /scheduleRevisionKey\(currentSchedule\) !== editorState\.baseRevision/);
  assert.match(saveSchedule, /if \(!accepted\) return false;\s*setEditorState\(null\)/s);
  assert.match(deleteSchedule, /scheduleRevisionKey\(currentSchedule\) !== editorState\.baseRevision/);
  assert.match(deleteSchedule, /if \(!accepted\) return false;/);
});

test('destructive day replacements abort if target or reviewed source changed while confirmation was open', () => {
  const app = source('src/App.jsx');
  const copy = app.slice(app.indexOf('const copyPreviousDay'), app.indexOf('const applyTemplate'));
  const template = app.slice(app.indexOf('const applyTemplate'), app.indexOf('const applySelectedPlanFeedback'));

  assert.match(copy, /const targetRevision = dayRevisionKey\(schedules\)/);
  assert.match(copy, /const sourceRevision = dayRevisionKey\(previousSchedules\)/);
  assert.match(copy, /setSchedules\(\(current, latestStore\) =>/);
  assert.match(copy, /dayRevisionKey\(current\) !== targetRevision/);
  assert.match(copy, /dayRevisionKey\(latestSource\) !== sourceRevision/);
  assert.match(copy, /instantiatePlans\(latestSource\)/);

  assert.match(template, /const targetRevision = dayRevisionKey\(schedules\)/);
  assert.match(template, /const templateRevision = entityRevisionKey\(template\)/);
  assert.match(template, /resolveTemplateForMutation\(template\.id, templateRevision\)/);
  assert.match(template, /dayRevisionKey\(current\) === targetRevision \? instantiatePlans\(latestTemplate\.schedules\) : null/);
});

test('plan feedback is recomputed against the latest atomic day rather than a stale rendered schedule list', () => {
  const app = source('src/App.jsx');
  const block = app.slice(app.indexOf('const applySelectedPlanFeedback'), app.indexOf('const restoreBackup'));
  assert.match(block, /resolveExperimentForMutation\(/);
  assert.match(block, /const accepted = setSchedules\(\(current\) =>/);
  assert.match(block, /createUniqueId\('schedule', current\.map\(\(schedule\) => schedule\.id\)\)/);
  assert.match(block, /applyPlanFeedback\(\s*experiment,\s*selectedDate,\s*current,/s);
  assert.match(block, /return result\.ok \? result\.schedules : null;/);
});
