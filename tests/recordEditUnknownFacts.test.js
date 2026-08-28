import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('record editor does not invent a date for legacy time-only reality', () => {
  const modal = source('src/components/RecordModal.jsx');
  assert.match(modal, /schedule\.actualStartDateKey \|\| \(schedule\.actualStartTime \? '' : \(dateKey \|\| ''\)\)/);
  assert.match(modal, /actualStartDateKey && !actualStartTime/);
  assert.match(modal, /!actualStartTime \|\| !actualStartDateKey \? null : actualStartDateKey/);
  assert.match(modal, /開始時刻だけ分かる旧記録は、開始日を推測せずそのまま保存します/);
});

test('changed record editor preserves an unknown actual category', () => {
  const modal = source('src/components/RecordModal.jsx');
  assert.match(modal, /schedule\.status === STATUS\.CHANGED \? \(schedule\.actualCategory \?\? ''\) : ''/);
  assert.match(modal, /<option value="">未記録<\/option>/);
  assert.match(modal, /\? \(actualCategory \|\| null\)/);
});
