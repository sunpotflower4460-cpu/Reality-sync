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
  assert.match(hook, /const applyState = useCallback\(\(updater\) =>/);
  assert.match(hook, /stateRef\.current = next;\s*setState\(next\);/s);
  assert.match(hook, /const current = stateRef\.current;/);
  assert.match(hook, /applyState\(\{ \.\.\.current, experiments: validated, needsWrite: true \}\)/);
});

test('experiment mutations report false when validation succeeds but the canonical data did not change', () => {
  const hook = source('src/hooks/useExperiments.js');
  assert.match(hook, /canonicalExperiments\(validated\) === canonicalExperiments\(current\.experiments\)/);
  assert.match(hook, /return false;/);
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

test('trial capture cannot pass the target count or accept a forged record identity', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const captureTrial');
  const end = hook.indexOf('const removeTrial', start);
  const block = hook.slice(start, end);
  assert.match(block, /target\.trials\.length >= target\.targetRuns/);
  assert.match(block, /const expectedRecordKey = canonicalRecordKey\(eligibleRecord\)/);
  assert.match(block, /eligibleRecord\.recordKey !== expectedRecordKey/);
  assert.match(block, /eligibleRecord\.dateKey < target\.startDateKey/);
  assert.match(block, /updated\.trials\.length !== target\.trials\.length \+ 1/);
});

test('finish and abandon refuse lifecycle transitions from a non-active experiment', () => {
  const hook = source('src/hooks/useExperiments.js');
  const finish = hook.slice(hook.indexOf('const finish'), hook.indexOf('const abandon'));
  const abandon = hook.slice(hook.indexOf('const abandon'), hook.indexOf('const deleteExperiment'));
  assert.match(finish, /target\.status !== 'active'/);
  assert.match(finish, /updated\.status !== 'completed'/);
  assert.match(abandon, /target\.status !== 'active'/);
  assert.match(abandon, /updated\.status !== 'abandoned'/);
});

test('experiment deletion cannot orphan a child or erase adopted learning provenance', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const deleteExperiment');
  const end = hook.indexOf('const resolveExperimentForMutation', start);
  const block = hook.slice(start, end);
  assert.match(block, /const target = current\.find\(\(experiment\) => experiment\.id === experimentId\)/);
  assert.match(block, /target\.status === 'completed' && target\.decision === 'adopt'/);
  assert.match(block, /current\.some\(\(experiment\) => experiment\.parentExperimentId === experimentId\)/);
  assert.match(block, /return current\.filter\(\(experiment\) => experiment\.id !== experimentId\)/);
});
