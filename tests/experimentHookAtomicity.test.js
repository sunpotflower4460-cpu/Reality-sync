import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('experiment mutations evaluate same-tick repeated actions against a synchronous latest-state snapshot', () => {
  const hook = source('src/hooks/useExperiments.js');
  assert.match(hook, /const stateRef = useRef\(state\)/);
  assert.match(hook, /stateRef\.current = state/);
  assert.match(hook, /const current = stateRef\.current;/);
  assert.match(hook, /stateRef\.current = nextState;\s*setState\(nextState\);/s);
});

test('starting an experiment rechecks active candidate identity inside the atomic mutation', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const startExperiment');
  const end = hook.indexOf('const startRevalidation', start);
  const block = hook.slice(start, end);
  assert.match(block, /updateExperiments\(\(current\) =>/);
  assert.match(block, /experiment\.status === 'active' && experiment\.candidateId === candidate\.id/);
  assert.match(block, /createUniqueId\('experiment', current\.map\(\(experiment\) => experiment\.id\)\)/);
});

test('revalidation derives source, active-lineage guard, id and next version from the atomic current list', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const startRevalidation');
  const end = hook.indexOf('const captureTrial', start);
  const block = hook.slice(start, end);
  assert.match(block, /const source = current\.find\(\(experiment\) => experiment\.id === sourceExperimentId\)/);
  assert.match(block, /experiment\.status === 'active' && \(experiment\.learningRootId \|\| experiment\.id\) === rootId/);
  assert.match(block, /createUniqueId\('experiment', current\.map\(\(item\) => item\.id\)\)/);
  assert.match(block, /learningVersion: nextLearningVersion\(current, source\)/);
});

test('experiment deletion cannot orphan a child learning version', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const deleteExperiment');
  const end = hook.indexOf('const replaceExperiments', start);
  const block = hook.slice(start, end);
  assert.match(block, /current\.some\(\(experiment\) => experiment\.parentExperimentId === experimentId\)/);
  assert.match(block, /return current\.filter\(\(experiment\) => experiment\.id !== experimentId\)/);
});
