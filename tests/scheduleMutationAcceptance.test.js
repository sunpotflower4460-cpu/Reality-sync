import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('schedule mutations synchronously report whether the latest hook state accepted the edit', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  assert.match(hook, /const stateRef = useRef\(state\)/);
  assert.match(hook, /const currentState = stateRef\.current;/);
  assert.match(hook, /if \(currentState\.persistenceBlocked \|\| currentState\.writeConflict\) return false;/);
  assert.match(hook, /stateRef\.current = nextState;\s*setState\(nextState\);\s*return true;/s);
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

test('destructive day replacements abort if the day changed while confirmation was open', () => {
  const app = source('src/App.jsx');
  const copy = app.slice(app.indexOf('const copyPreviousDay'), app.indexOf('const applyTemplate'));
  const template = app.slice(app.indexOf('const applyTemplate'), app.indexOf('const applySelectedPlanFeedback'));
  assert.match(copy, /const baseRevision = dayRevisionKey\(schedules\)/);
  assert.match(copy, /dayRevisionKey\(current\) === baseRevision \? instantiatePlans\(previousSchedules\) : null/);
  assert.match(template, /const baseRevision = dayRevisionKey\(schedules\)/);
  assert.match(template, /dayRevisionKey\(current\) === baseRevision \? instantiatePlans\(template\.schedules\) : null/);
});

test('plan feedback is recomputed against the latest atomic day rather than a stale rendered schedule list', () => {
  const app = source('src/App.jsx');
  const block = app.slice(app.indexOf('const applySelectedPlanFeedback'), app.indexOf('const restoreBackup'));
  assert.match(block, /const accepted = setSchedules\(\(current\) =>/);
  assert.match(block, /createUniqueId\('schedule', current\.map\(\(schedule\) => schedule\.id\)\)/);
  assert.match(block, /applyPlanFeedback\(\s*experiment,\s*selectedDate,\s*current,/s);
  assert.match(block, /return result\.ok \? result\.schedules : null;/);
});
