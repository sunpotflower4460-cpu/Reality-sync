import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('app shell uses compact light navigation chrome instead of a giant branded hero', () => {
  const text = source('src/App.jsx');
  assert.match(text, /app-shell-header/);
  assert.match(text, /RealitySync/);
  assert.match(text, /bg-white\/9[0-9]/);
  assert.doesNotMatch(text, /bg-gradient-to-r from-violet-600/);
  assert.doesNotMatch(text, /text-4xl font-black/);
});

test('system typography and 44 point controls remain part of the mobile design foundation', () => {
  const css = source('src/index.css');
  assert.match(css, /-apple-system/);
  assert.match(css, /BlinkMacSystemFont/);
  assert.match(css, /\.tap-target\s*\{[\s\S]*min-height: 44px/);
  assert.match(css, /\.tap-target\s*\{[\s\S]*min-width: 44px/);
});

test('grouped surfaces preserve keyboard focus visibility, Safari legends and 44px actions', () => {
  const css = source('src/index.css');
  const record = source('src/components/RecordModal.jsx');
  assert.match(css, /\.app-group :is\(button, a, input, select, textarea, summary\):focus-visible/);
  assert.match(css, /fieldset\.app-group > legend/);
  assert.match(record, /min-h-11/);
});

test('tab bar stays attached to the bottom edge and uses tint rather than a filled active tile', () => {
  const text = source('src/components/BottomNav.jsx');
  assert.match(text, /fixed bottom-0/);
  assert.match(text, /pb-safe/);
  assert.doesNotMatch(text, /rounded-2xl.*shadow/s);
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
  assert.match(text, /const planned = recorded \? recordedPlanForSchedule\(schedule\) : schedule/);
  assert.match(text, /予定負荷 \{plannedStress\}/);
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
  assert.match(text, /app-group divide-y divide-slate-100/);
  assert.match(text, /データの削除/);
  assert.match(text, /text-rose-500/);
  assert.doesNotMatch(text, /font-black/);
});

test('primary UI still exposes only plan record and analytics navigation', () => {
  const text = source('src/components/BottomNav.jsx');
  for (const label of ['計画', '記録', '分析']) assert.match(text, new RegExp(label));
  for (const hiddenConcept of ['Retention', 'Context Shift', 'Scope Precision', '実験']) {
    assert.doesNotMatch(text, new RegExp(hiddenConcept));
  }
});
