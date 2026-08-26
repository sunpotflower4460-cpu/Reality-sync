import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('mobile dialog system supports bottom sheets while retaining desktop centered presentation', () => {
  const text = source('src/components/ModalDialog.jsx');
  assert.match(text, /placement = 'center'/);
  assert.match(text, /placement === 'sheet'/);
  assert.match(text, /items-end justify-center p-0 sm:items-center sm:p-4/);
  assert.match(text, /bg-slate-950\/48/);
});

test('every everyday mobile modal uses the shared sheet presentation', () => {
  for (const path of [
    'src/components/RecordModal.jsx',
    'src/components/ScheduleEditorModal.jsx',
    'src/components/SettingsModal.jsx',
    'src/components/PlanFeedbackModal.jsx',
    'src/components/TemplateModal.jsx',
    'src/components/LegalModal.jsx',
  ]) {
    assert.match(source(path), /placement="sheet"/, path);
  }
});

test('plan cards prioritize time title and duration before subtle load metadata', () => {
  const text = source('src/components/PlanView.jsx');
  assert.match(text, /負荷 \{schedule\.plannedStress\}/);
  assert.match(text, /ChevronRight/);
  assert.match(text, /記録済み/);
  assert.doesNotMatch(text, /Pencil/);
  assert.doesNotMatch(text, /absolute inset-y-3 left-0 w-\[3px\]/);
});

test('analytics keeps completion rate informative without turning percentage into a giant score', () => {
  const text = source('src/components/AnalyticsView.jsx');
  assert.match(text, /予定通り ・ \{stats\.completionRate\}%/);
  assert.match(text, /\{stats\.completed\}.*\{stats\.total\}/s);
  assert.match(text, /結果ではなく、次の予定の材料/);
  assert.doesNotMatch(text, /text-\[2rem\].*completionRate/s);
});

test('settings keeps routine controls first and destructive deletion visually secondary but explicit', () => {
  const text = source('src/components/SettingsModal.jsx');
  const reminder = text.indexOf('>記録リマインダー<');
  const backup = text.indexOf('>バックアップ<');
  const privacy = text.indexOf('>プライバシーとサポート<');
  const deletion = text.lastIndexOf('>この端末のデータをすべて削除<');
  assert.ok(reminder > -1 && backup > reminder && privacy > backup && deletion > privacy);
  assert.match(text, /peer-checked:bg-indigo-600/);
  assert.doesNotMatch(text, /rounded-2xl border border-red-100 bg-red-50\/40/);
});

test('phase 19 does not expand the primary product navigation or surface internal learning vocabulary', () => {
  const nav = source('src/components/BottomNav.jsx');
  const app = source('src/App.jsx');
  assert.match(nav, /計画/);
  assert.match(nav, /記録/);
  assert.match(nav, /分析/);
  assert.doesNotMatch(nav, /実験|Retention|Context Shift|Scope Precision/);
  assert.doesNotMatch(app, /WeeklyPlanFeedbackModal|InsightCandidatesView|ExperimentSetupModal/);
});
