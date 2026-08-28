import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

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
