import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('adopted experiment history cannot be individually deleted from persistence', () => {
  const hook = source('src/hooks/useExperiments.js');
  const start = hook.indexOf('const deleteExperiment');
  const end = hook.indexOf('const resolveExperimentForMutation', start);
  const block = hook.slice(start, end);
  assert.match(block, /const target = current\.find\(\(experiment\) => experiment\.id === experimentId\)/);
  assert.match(block, /target\.status === 'completed' && target\.decision === 'adopt'/);
  assert.match(block, /return null;/);
});

test('history UI hides individual delete for adopted learning and explains provenance preservation', () => {
  const panel = source('src/components/ExperimentPanel.jsx');
  const start = panel.indexOf('function PastExperiment');
  const block = panel.slice(start);
  assert.match(block, /const adopted = experiment\.status === EXPERIMENT_STATUS\.COMPLETED && experiment\.decision === EXPERIMENT_DECISION\.ADOPT/);
  assert.match(block, /const canDelete = !hasChildren && !adopted/);
  assert.match(block, /\{canDelete && <button/);
  assert.match(block, /予定やテンプレートの適用履歴の出所/);
  assert.match(block, /設定とデータの全削除/);
});
