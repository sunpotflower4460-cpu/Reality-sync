import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('date navigation keeps the displayed date as the picker target with 44 point day controls', () => {
  const text = source('src/components/DateNavigator.jsx');
  assert.match(text, /grid-cols-\[2\.75rem_minmax\(0,1fr\)_2\.75rem\]/);
  assert.match(text, /tap-target/);
  assert.match(text, /absolute inset-0 h-full w-full cursor-pointer opacity-0/);
  assert.match(text, /日付を選ぶ/);
  assert.match(text, /今日に戻る/);
});

test('bottom navigation is edge attached, safe-area aware and never a floating selection card', () => {
  const text = source('src/components/BottomNav.jsx');
  assert.match(text, /fixed inset-x-0 bottom-0/);
  assert.match(text, /border-t border-slate-200\/75/);
  assert.match(text, /min-h-12/);
  assert.match(text, /pb-safe/);
  assert.match(text, /grid grid-cols-3/);
  assert.doesNotMatch(text, /rounded-\[1\.3rem\].*shadow/s);
  assert.doesNotMatch(text, /bg-indigo-50 text-indigo-700/);
});

test('record flow keeps routine fields together in one grouped mobile sheet', () => {
  const text = source('src/components/RecordModal.jsx');
  assert.match(text, /実際どうだった？/);
  assert.match(text, /grid grid-cols-3 gap-1/);
  assert.match(text, /実際にかかった時間/);
  assert.match(text, /実際の負荷/);
  assert.match(text, /終わった時の気分/);
  assert.match(text, /placement="sheet"/);
  assert.match(text, /app-group divide-y divide-slate-100/);
  assert.match(text, /開始日時を詳しく残す/);
  assert.match(text, /開始日時・変更理由を詳しく残す/);
  assert.match(text, /この内容で記録する/);
});

test('stress graph preserves truth notes while staying compact', () => {
  const text = source('src/components/StressGraph.jsx');
  assert.match(text, /const HEIGHT = 250/);
  assert.match(text, /負荷の波/);
  assert.match(text, /<details/);
  assert.match(text, /表示について/);
  assert.match(text, /予定時刻への推測配置はしていません/);
});

test('mobile shell uses dynamic viewport, safe areas and reserves content space above the tab bar', () => {
  const app = source('src/App.jsx');
  const css = source('src/index.css');
  assert.match(app, /min-h-dvh/);
  assert.match(app, /pt-app-safe/);
  assert.match(app, /pb-\[calc\(5\.25rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /pb-modal-safe/);
  assert.match(css, /\.tap-target/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
});

test('mobile form controls avoid iOS zoom and expose a touch-friendly stress slider', () => {
  const css = source('src/index.css');
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /\.reality-range/);
  assert.match(css, /::-webkit-slider-thumb/);
  assert.match(css, /-webkit-text-size-adjust: 100%/);
});
