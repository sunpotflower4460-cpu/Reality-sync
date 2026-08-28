import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('non-schedule persistence domains compare latest storage before writing local dirty state', () => {
  for (const [path, storageRead, serializer] of [
    ['src/hooks/useScheduleTemplates.js', 'parseStoredTemplatesResult', 'serializeTemplates'],
    ['src/hooks/useExperiments.js', 'parseStoredExperimentsForPersistence', 'canonicalExperiments'],
    ['src/hooks/useReminderPreferences.js', 'parseStoredReminderPreferencesResult', 'serializePreferences'],
  ]) {
    const text = source(path);
    assert.match(text, /baseSerialized/);
    assert.match(text, /writeConflict/);
    assert.match(text, new RegExp(`${storageRead}\\(`));
    assert.match(text, new RegExp(`${serializer}\\(`));
    assert.match(text, /latestSerialized !== baseSerialized/);
    assert.match(text, /if \(persistenceBlocked \|\| writeConflict \|\| !needsWrite\) return;/);
  }
});

test('storage events preserve local dirty state and turn remote divergence into an explicit conflict', () => {
  for (const path of [
    'src/hooks/useScheduleTemplates.js',
    'src/hooks/useExperiments.js',
    'src/hooks/useReminderPreferences.js',
  ]) {
    const text = source(path);
    assert.match(text, /if \(current\.needsWrite\)/);
    assert.match(text, /!== current\.baseSerialized/);
    assert.match(text, /writeConflict: true/);
    assert.match(text, /if \(current\.writeConflict\) return current;/);
  }
});

test('app aggregates write conflicts from every persistent domain and keeps backup rescue available', () => {
  const app = source('src/App.jsx');
  const settings = source('src/components/SettingsModal.jsx');
  assert.match(app, /templateStorageProtection\.writeConflict/);
  assert.match(app, /experimentStorageProtection\.writeConflict/);
  assert.match(app, /reminderStorageProtection\.writeConflict/);
  assert.match(app, /conflictDomains\.push\('テンプレート'\)/);
  assert.match(app, /conflictDomains\.push\('実験履歴'\)/);
  assert.match(app, /conflictDomains\.push\('リマインダー設定'\)/);
  assert.match(settings, /const storageConflict = Boolean\(storageProtection\?\.writeConflict\)/);
  assert.match(settings, /別の画面との編集競合/);
  assert.match(settings, /disabled=\{storageBlocked\}/);
});

test('destructive erase verifies persistent deletion before clearing React state', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const eraseStorage = settings.indexOf('const erased = eraseStoredRealitySyncData()');
  const clearState = settings.indexOf('onEraseAllData();', eraseStorage);
  const failureGuard = settings.indexOf('if (!erased)', eraseStorage);
  assert.ok(eraseStorage >= 0);
  assert.ok(failureGuard > eraseStorage);
  assert.ok(clearState > failureGuard, 'React state must be cleared only after storage deletion succeeds');

  const app = source('src/App.jsx');
  const eraseBody = app.slice(app.indexOf('const eraseAllData = () => {'), app.indexOf('const openLegal'));
  assert.doesNotMatch(eraseBody, /localStorage/);
  assert.doesNotMatch(eraseBody, /removeItem/);
});
