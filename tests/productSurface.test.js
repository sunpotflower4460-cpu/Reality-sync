import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('analytics keeps the original ideal-versus-reality experience as the default surface', () => {
  const text = source('src/components/AnalyticsView.jsx');
  assert.match(text, /理想と現実の時間/);
  assert.match(text, /今日の記録/);
  assert.match(text, /記録からの気づき/);
  assert.match(text, /週・月の振り返り/);
  assert.doesNotMatch(text, /InsightCandidatesView/);
  assert.doesNotMatch(text, /ContextShiftReviewSection/);
  assert.doesNotMatch(text, /\['insights', '傾向'\]/);
});

test('plan view keeps schedules primary and reduces learning output to one natural hint', () => {
  const text = source('src/components/PlanView.jsx');
  assert.match(text, /理想のスケジュール/);
  assert.match(text, /前の記録からのヒント/);
  assert.match(text, /const primaryHint = planFeedbackSuggestions\[0\]/);
  assert.match(text, /予定を楽に作る/);
  assert.doesNotMatch(text, /今週の現実適応プラン/);
  assert.doesNotMatch(text, /実験から学んだ計画の工夫/);
  assert.doesNotMatch(text, /学習提案/);
  assert.doesNotMatch(text, /採用済みの工夫を反映/);
});

test('plan hint preview avoids experiment metrics and technical learning vocabulary', () => {
  const text = source('src/components/PlanFeedbackModal.jsx');
  assert.match(text, /前の記録からのヒント/);
  assert.match(text, /予定はこう変わります/);
  assert.match(text, /RealitySyncが予定を勝手に変えることはありません/);
  assert.doesNotMatch(text, /過去の失敗率/);
  assert.doesNotMatch(text, /試行/);
  assert.doesNotMatch(text, /採用元の実験/);
  assert.doesNotMatch(text, /実験で採用した工夫/);
});

test('app no longer exposes weekly optimization or experiment management in the primary flow', () => {
  const text = source('src/App.jsx');
  assert.doesNotMatch(text, /WeeklyPlanFeedbackModal/);
  assert.doesNotMatch(text, /buildWeeklyPlanFeedback/);
  assert.doesNotMatch(text, /applyWeeklyPlanFeedback/);
  assert.doesNotMatch(text, /onStartExperiment=/);
  assert.doesNotMatch(text, /onStartRevalidation=/);
  assert.match(text, /<PlanView/);
  assert.match(text, /<TrackView/);
  assert.match(text, /<AnalyticsView/);
});
