import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('record sessions snapshot the schedule revision and refuse stale saves without remounting to remote data', () => {
  const app = source('src/App.jsx');
  const modal = source('src/components/RecordModal.jsx');

  assert.match(app, /const \[recordSession, setRecordSession\] = useState\(null\)/);
  assert.match(app, /baseRevision: scheduleRevisionKey\(schedule\)/);
  assert.match(app, /scheduleRevisionKey\(currentSchedule\) !== recordSession\.baseRevision/);
  assert.match(app, /schedule=\{recordSession\.schedule\}/);
  assert.match(app, /stale=\{recordSessionStale\}/);
  assert.doesNotMatch(app, /scheduleRevisionKey\(selectedSchedule\)/);

  assert.match(modal, /stale = false/);
  assert.match(modal, /別の画面でこの予定が更新されました/);
  assert.match(modal, /disabled=\{stale\}/);
  assert.match(modal, /if \(saved === false\)/);
});

test('plan edit sessions keep their opening snapshot and block stale save or delete operations', () => {
  const app = source('src/App.jsx');
  const modal = source('src/components/ScheduleEditorModal.jsx');

  assert.match(app, /setEditorState\(\{\s*type: 'edit',\s*id: schedule\.id,\s*baseRevision: scheduleRevisionKey\(schedule\),\s*schedule,/s);
  assert.match(app, /scheduleRevisionKey\(currentSchedule\) !== editorState\.baseRevision/);
  assert.match(app, /const editingSchedule = editorState\?\.type === 'edit' \? editorState\.schedule : null/);
  assert.match(app, /stale=\{editorSessionStale\}/);

  assert.match(modal, /if \(!schedule \|\| !onDelete \|\| stale\) return;/);
  assert.match(modal, /保存と削除を停止しました/);
  assert.match(modal, /disabled=\{stale\}/g);
  assert.match(modal, /if \(deleted === false\)/);
});
