import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const app = source('src/App.jsx');

test('midnight rollover defers today navigation while an interactive modal is open', () => {
  const start = app.indexOf('useEffect(() => {\n    const previousTodayKey = previousTodayKeyRef.current;');
  const end = app.indexOf('\n\n  const changeDate', start);
  assert.ok(start >= 0 && end > start, 'midnight rollover effect should exist');
  const block = app.slice(start, end);

  const interactionGuard = block.indexOf('if (recordSession || editorState || isTemplateModalOpen || selectedPlanFeedbackId) return;');
  const commitToday = block.indexOf('previousTodayKeyRef.current = todayKey;', interactionGuard);
  const navigateToday = block.indexOf('setSelectedDate(todayKey);', interactionGuard);
  assert.ok(interactionGuard >= 0, 'rollover should wait for transient interactions');
  assert.ok(commitToday > interactionGuard, 'today ref must not advance before the interaction guard');
  assert.ok(navigateToday > commitToday, 'today navigation should happen only after the deferred rollover is committed');

  assert.doesNotMatch(block, /setRecordSession\(null\)/);
  assert.doesNotMatch(block, /setEditorState\(null\)/);
  assert.doesNotMatch(block, /setIsTemplateModalOpen\(false\)/);
  assert.doesNotMatch(block, /setSelectedPlanFeedbackId\(null\)/);
});

test('closing a deferred interaction can retrigger midnight rollover', () => {
  const effectEnd = app.indexOf('\n\n  const changeDate', app.indexOf('const previousTodayKey = previousTodayKeyRef.current;'));
  const effectStart = app.lastIndexOf('useEffect(() => {', effectEnd);
  const block = app.slice(effectStart, effectEnd);
  assert.match(block, /\[editorState, isTemplateModalOpen, recordSession, selectedDate, selectedPlanFeedbackId, todayKey\]/);
  assert.match(block, /if \(selectedDate !== previousTodayKey\) \{\s*previousTodayKeyRef\.current = todayKey;\s*return;/s);
});

test('schedule editor only warns on exit after form values differ from their initial revision', () => {
  const text = source('src/components/ScheduleEditorModal.jsx');
  assert.match(text, /const dirty = time !== initialTime/);
  assert.match(text, /title !== initialTitle/);
  assert.match(text, /duration !== initialDuration/);
  assert.match(text, /plannedStress !== initialPlannedStress/);
  assert.match(text, /if \(!dirty \|\| window\.location\.protocol === 'file:'\) return undefined;/);
  assert.match(text, /window\.addEventListener\('beforeunload', guardUnsavedInput\)/);
  assert.match(text, /入力途中の変更があります。保存せずに閉じますか？/);
  assert.match(text, /<ModalDialog\s+onClose=\{requestClose\}/s);
  assert.match(text, /onClick=\{requestClose\} aria-label="予定編集を閉じる"/);
});

test('record modal protects real draft changes without treating numeric input stringification as a change', () => {
  const text = source('src/components/RecordModal.jsx');
  assert.match(text, /function draftValueKey\(value\)/);
  assert.match(text, /draftValueKey\(actualDuration\) !== draftValueKey\(initialActualDuration\)/);
  assert.doesNotMatch(text, /stressEditing !==/);
  assert.match(text, /if \(!dirty \|\| window\.location\.protocol === 'file:'\) return undefined;/);
  assert.match(text, /入力途中の実績があります。保存せずに閉じますか？/);
  assert.match(text, /<ModalDialog\s+onClose=\{requestClose\}/s);
  assert.match(text, /onClick=\{requestClose\} aria-label="記録画面を閉じる"/);
});

test('template name draft is protected on modal close, page exit, and template apply', () => {
  const text = source('src/components/TemplateModal.jsx');
  assert.match(text, /const dirty = name\.length > 0;/);
  assert.match(text, /if \(!dirty \|\| window\.location\.protocol === 'file:'\) return undefined;/);
  assert.match(text, /入力途中のテンプレート名があります。保存せずに閉じますか？/);
  assert.match(text, /入力途中のテンプレート名は保存されていません。この名前を破棄してテンプレートを適用しますか？/);
  assert.match(text, /<ModalDialog\s+onClose=\{requestClose\}/s);
  assert.match(text, /onClick=\{requestClose\} aria-label="テンプレート画面を閉じる"/);
});
