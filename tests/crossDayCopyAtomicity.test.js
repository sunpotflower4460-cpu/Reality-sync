import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('schedule updater exposes the same latest-store snapshot used for target-day preflight', () => {
  const hook = source('src/hooks/usePersistentSchedules.js');
  assert.match(hook, /nextValue\(currentDay, currentState\.store\)/);
});

test('previous-day replacement aborts if either target or source changed while confirmation was open', () => {
  const app = source('src/App.jsx');
  const start = app.indexOf('const copyPreviousDay');
  const end = app.indexOf('const applyTemplate', start);
  const block = app.slice(start, end);
  assert.match(block, /const targetRevision = dayRevisionKey\(schedules\)/);
  assert.match(block, /const sourceRevision = dayRevisionKey\(previousSchedules\)/);
  assert.match(block, /setSchedules\(\(current, latestStore\) =>/);
  assert.match(block, /const latestSource = latestStore\.days\[previousDate\] \?\? \[\]/);
  assert.match(block, /dayRevisionKey\(current\) !== targetRevision/);
  assert.match(block, /dayRevisionKey\(latestSource\) !== sourceRevision/);
  assert.match(block, /instantiatePlans\(latestSource\)/);
});
