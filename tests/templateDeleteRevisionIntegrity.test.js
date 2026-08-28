import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('template deletion requires the exact revision the user confirmed', () => {
  const hook = source('src/hooks/useScheduleTemplates.js');
  const start = hook.indexOf('const deleteTemplate');
  const end = hook.indexOf('const resolveTemplateForMutation', start);
  const block = hook.slice(start, end);
  assert.match(block, /deleteTemplate = useCallback\(\(templateId, expectedRevision = null\)/);
  assert.match(block, /const template = current\.find\(\(item\) => item\.id === templateId\)/);
  assert.match(block, /expectedRevision !== null && JSON\.stringify\(template\) !== expectedRevision/);
  assert.match(block, /return current\.filter\(\(item\) => item\.id !== templateId\)/);
});

test('template modal snapshots the reviewed revision before confirmation and passes it to deletion', () => {
  const modal = source('src/components/TemplateModal.jsx');
  const start = modal.indexOf('const deleteTemplate');
  const end = modal.indexOf('return (', start);
  const block = modal.slice(start, end);
  assert.match(block, /const reviewedRevision = JSON\.stringify\(template\)/);
  assert.match(block, /window\.confirm/);
  assert.match(block, /onDeleteTemplate\(template\.id, reviewedRevision\)/);
  assert.match(block, /if \(deleted === false\)/);
});
