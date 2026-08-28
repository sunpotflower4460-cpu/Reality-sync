import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUniqueId, hasDuplicateIds } from '../src/utils/id.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('createUniqueId retries colliding candidates before accepting one', () => {
  const candidates = ['taken', 'taken', 'fresh'];
  const id = createUniqueId('item', ['taken'], () => candidates.shift());
  assert.equal(id, 'fresh');
});

test('createUniqueId has a deterministic collision-free fallback when candidate generation keeps colliding', () => {
  const originalNow = Date.now;
  Date.now = () => 12345;
  try {
    const id = createUniqueId('item', ['taken', 'item-12345-1', 'item-12345-2'], () => 'taken');
    assert.equal(id, 'item-12345-3');
  } finally {
    Date.now = originalNow;
  }
});

test('duplicate entity ids are detectable before normalization can drop an item', () => {
  assert.equal(hasDuplicateIds([{ id: 'a' }, { id: 'b' }]), false);
  assert.equal(hasDuplicateIds([{ id: 'a' }, { id: 'a' }]), true);
  assert.equal(hasDuplicateIds([{ id: 1 }, { id: '1' }]), true);
});

test('schedule, template and experiment creation flows use collision-safe ids', () => {
  const app = source('src/App.jsx');
  const templates = source('src/hooks/useScheduleTemplates.js');
  const experiments = source('src/hooks/useExperiments.js');
  assert.match(app, /createUniqueId\('schedule'/);
  assert.match(templates, /createUniqueId\('template'/);
  assert.match(experiments, /createUniqueId\('experiment'/);
  assert.match(templates, /hasDuplicateIds\(next\)/);
  assert.match(experiments, /hasDuplicateIds\(next\)/);
});
