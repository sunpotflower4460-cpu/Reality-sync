import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('app shell uses compact light navigation chrome instead of a giant branded hero', () => {
  const text = source('src/App.jsx');
  assert.match(text, /border-b border-slate-200\/70 bg-white\/90/);
  assert.match(text, /tap-target/);
  assert.doesNotMatch(text, /理想と現実のギャップを、次の予定へ/);
  assert.doesNotMatch(text, /rounded-b-\[1\.55rem\].*bg-gradient-to-br/s);
});

test('system typography and 44 point controls remain part of the mobile design foundation', () => {
  const text = source('src/index.css');
  assert.match(text, /font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text"/);
  assert.match(text, /\.tap-target/);
  assert.match(text, /min-width: 44px/);
  assert.match(text, /min-height: 44px/);
  assert.match(text, /\.app-group/);
});

test('grouped surfaces preserve keyboard focus visibility, Safari legends and 44px actions', () => {
  const text = source('src/index.css');
  assert.match(text, /fieldset\.app-group\s*\{\s*overflow: visible;/s);
  assert.match(text, /\.app-group > button:focus-visible/);
  assert.match(text, /outline-offset: -3px/);
  assert.match(text, /\.app-group button,[\s\S]*\.sheet-scroll button\s*\{\s*min-height: 44px;/);
});

test('tab bar stays attached to the bottom edge and uses tint rather than a filled active tile', () => {
  const text = source('src/components/BottomNav.jsx');
  assert.match(text, /border-t border-slate-200\/75 bg-white\/92/);
  assert.match(text, /active \? 'text-indigo-600'/);
  assert.doesNotMatch(text, /pointer-events-none fixed/);
  assert.doesNotMatch(text, /rounded-\[1\.3rem\].*shadow/s);
});

test('plan schedules use one grouped list with subtle load metadata', () => {
  const text = source('src/components/PlanView.jsx');
  assert.match(text, /app-group divide-y divide-slate-100/);
  assert.match(text, /w-\[3rem\].*time/s);
  assert.match(text, /h-1\.5 w-1\.5 rounded-full/);
  assert.doesNotMatch(text, /rounded-xl bg-indigo-50\/75 py-2/);
  assert.doesNotMatch(text, /font-black/);
});

test('reality timeline keeps recorded facts explicit while using compact inline metrics', () => {
  const text = source('src/components/TrackView.jsx');
  assert.match(text, /予定負荷 \{schedule\.plannedStress\}/);
  assert.match(text, /実負荷 \{schedule\.actualStress \?\? '—'\}/);
  assert.match(text, /実時間 \{schedule\.actualDuration === null \? '—'/);
  assert.match(text, /w-\[2px\]/);
  assert.doesNotMatch(text, /function Metric/);
});

test('record modal groups duration load and mood instead of presenting three equally heavy cards', () => {
  const text = source('src/components/RecordModal.jsx');
  const group = text.indexOf('app-group divide-y divide-slate-100');
  const duration = text.indexOf('実際にかかった時間', group);
  const stress = text.indexOf('実際の負荷', group);
  const mood = text.indexOf('終わった時の気分', group);
  assert.ok(group > -1 && duration > group && stress > duration && mood > stress);
  assert.match(text, /grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1/);
});

test('settings uses grouped rows and keeps destructive data deletion isolated', () => {
  const text = source('src/components/SettingsModal.jsx');
  assert.match(text, /SectionLabel/);
  assert.match(text, /app-group divide-y divide-slate-100/);
  assert.match(text, /データの削除/);
  assert.match(text, /この端末のデータをすべて削除/);
  assert.doesNotMatch(text, /grid grid-cols-2 gap-2/);
});

test('primary UI still exposes only plan record and analytics navigation', () => {
  const text = source('src/components/BottomNav.jsx');
  assert.match(text, /label: '計画'/);
  assert.match(text, /label: '記録'/);
  assert.match(text, /label: '分析'/);
  assert.doesNotMatch(text, /実験|最適化|Retention|Context Shift|Scope Precision/);
});
