import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('persistent hooks update their synchronous ref on storage-event transitions before the next render', () => {
  for (const path of [
    'src/hooks/usePersistentSchedules.js',
    'src/hooks/useScheduleTemplates.js',
    'src/hooks/useExperiments.js',
    'src/hooks/useReminderPreferences.js',
  ]) {
    const hook = source(path);
    assert.match(hook, /const stateRef = useRef\(state\)/, path);
    assert.match(hook, /const applyState = useCallback\(\(updater\) =>/, path);
    assert.match(hook, /stateRef\.current = next;\s*setState\(next\);/s, path);
    const storageListener = hook.slice(hook.indexOf("addEventListener('storage'", 0) - 2500);
    assert.match(storageListener, /applyState\(\(current\) =>/, path);
  }
});

test('template and reminder mutations preflight latest storage and return rejection instead of stale UI success', () => {
  const templates = source('src/hooks/useScheduleTemplates.js');
  const reminders = source('src/hooks/useReminderPreferences.js');
  for (const [text, label] of [[templates, 'templates'], [reminders, 'reminders']]) {
    assert.match(text, /const latestStateBeforeMutation = useCallback/, label);
    assert.match(text, /if \(current\.persistenceBlocked \|\| current\.writeConflict\) return null;/, label);
  }
  assert.match(templates, /const current = latestStateBeforeMutation\(\);\s*if \(!current\) return false;/s);
  assert.match(templates, /applyState\(\{ \.\.\.current, templates: validated, needsWrite: true \}\);\s*return true;/s);
  assert.match(reminders, /const current = latestStateBeforeMutation\(\);\s*if \(!current\) return false;/s);
  assert.match(reminders, /applyState\(\{ \.\.\.current, preferences: validated, needsWrite: true \}\);\s*return true;/s);
});

test('notification permission success copy is conditional on RealitySync accepting the preference update', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const request = settings.slice(settings.indexOf('const requestNotifications'), settings.indexOf('const eraseAllData'));
  assert.match(request, /const accepted = onChangeReminderPreferences/);
  assert.match(request, /if \(!accepted\)/);
  assert.match(request, /OSの通知許可は確認できましたが/);
  assert.match(request, /OSの通知許可を確認し、RealitySyncの通知設定を有効にしました。/);
  assert.doesNotMatch(request, /OS通知を有効にしました。/);
});
