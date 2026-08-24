import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('date navigation uses the displayed date as the mobile date-picker target with 44px day controls', () => {
  const text = source('src/components/DateNavigator.jsx');
  assert.match(text, /grid-cols-\[2\.75rem_minmax\(0,1fr\)_2\.75rem\]/);
  assert.match(text, /h-11 w-11/);
  assert.match(text, /absolute inset-0 h-full w-full cursor-pointer opacity-0/);
  assert.match(text, /タップして日付を変更/);
});

test('bottom navigation provides large thumb targets and a visible active surface', () => {
  const text = source('src/components/BottomNav.jsx');
  assert.match(text, /min-h-14/);
  assert.match(text, /bg-indigo-50 text-indigo-600/);
  assert.match(text, /pb-safe/);
});

test('record flow keeps the everyday fields primary and folds optional timing and reasons away', () => {
  const text = source('src/components/RecordModal.jsx');
  assert.match(text, /実際どうだった？/);
  assert.match(text, /grid grid-cols-3 gap-2/);
  assert.match(text, /実際にかかった時間/);
  assert.match(text, /実際の負荷/);
  assert.match(text, /終わった時の気分/);
  assert.match(text, /<details/);
  assert.match(text, /開始日時を詳しく残す/);
  assert.match(text, /開始日時・変更理由を詳しく残す/);
  assert.match(text, /この内容で記録する/);
});

test('stress graph preserves truth notes without putting technical caveats in the primary reading path', () => {
  const text = source('src/components/StressGraph.jsx');
  assert.match(text, /負荷の波/);
  assert.match(text, /<details/);
  assert.match(text, /表示について/);
  assert.match(text, /予定時刻への推測配置はしていません/);
});

test('mobile shell uses dynamic viewport and safe-area padding', () => {
  const app = source('src/App.jsx');
  const css = source('src/index.css');
  assert.match(app, /min-h-dvh/);
  assert.match(app, /pt-app-safe/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /pb-modal-safe/);
});
