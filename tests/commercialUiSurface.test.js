import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('commercial polish keeps the original three-part product hierarchy visible', () => {
  const plan = source('src/components/PlanView.jsx');
  const track = source('src/components/TrackView.jsx');
  const analytics = source('src/components/AnalyticsView.jsx');

  assert.match(plan, /PLAN/);
  assert.match(plan, /理想のスケジュール/);
  assert.match(track, /REALITY/);
  assert.match(track, /今日の現実/);
  assert.match(analytics, /REFLECT/);
  assert.match(analytics, /理想と現実を見比べる/);
});

test('plan empty state offers one clear primary start action instead of adding another workflow', () => {
  const text = source('src/components/PlanView.jsx');
  assert.match(text, /最初の予定を1つ置いてみる/);
  assert.match(text, /予定を追加する/);
  assert.match(text, /const primaryHint = planFeedbackSuggestions\[0\]/);
  assert.doesNotMatch(text, /最適化/);
  assert.doesNotMatch(text, /ダッシュボード/);
});

test('timeline uses calm white cards with narrow status accents rather than full tinted status panels', () => {
  const text = source('src/components/TrackView.jsx');
  assert.match(text, /app-card relative w-full/);
  assert.match(text, /absolute inset-y-3 left-0 w-\[2px\]/);
  assert.doesNotMatch(text, /border-green-200 bg-green-50/);
  assert.doesNotMatch(text, /border-orange-200 bg-orange-50/);
  assert.doesNotMatch(text, /border-red-200 bg-red-50/);
});

test('timeline never presents missing recorded duration or load as a synthetic zero', () => {
  const text = source('src/components/TrackView.jsx');
  assert.match(text, /schedule\.actualDuration === null \? '—' : `\$\{schedule\.actualDuration\}分`/);
  assert.match(text, /schedule\.actualStress \?\? '—'/);
  assert.doesNotMatch(text, /actualDuration \?\? 0/);
});

test('analytics makes the selected day and ideal-versus-reality time the primary commercial reading order', () => {
  const text = source('src/components/AnalyticsView.jsx');
  const completion = text.indexOf('この日の記録');
  const comparison = text.indexOf('理想と現実の時間');
  const weekMonth = text.indexOf('週・月の振り返り');
  assert.ok(completion > -1);
  assert.ok(comparison > completion);
  assert.ok(weekMonth > -1);
  assert.match(text, /記録からの気づき/);
});

test('commercial shell stays content first without adding navigation beyond the three core tabs', () => {
  const nav = source('src/components/BottomNav.jsx');
  const app = source('src/App.jsx');
  const css = source('src/index.css');

  assert.match(nav, /grid grid-cols-3/);
  assert.match(nav, /計画/);
  assert.match(nav, /記録/);
  assert.match(nav, /分析/);
  assert.doesNotMatch(nav, /設定.*label/);
  assert.match(app, /bg-white\/90/);
  assert.doesNotMatch(app, /bg-gradient-to-br from-indigo-600/);
  assert.match(css, /\.app-card-strong/);
  assert.match(css, /\.app-group/);
});
