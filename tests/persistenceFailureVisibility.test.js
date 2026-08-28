import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('storage read exceptions block persistence instead of treating unseen data as empty', () => {
  for (const path of [
    'src/hooks/usePersistentSchedules.js',
    'src/hooks/useScheduleTemplates.js',
    'src/hooks/useExperiments.js',
    'src/hooks/useReminderPreferences.js',
  ]) {
    const text = source(path);
    const catchIndex = text.indexOf('catch {');
    assert.notEqual(catchIndex, -1, `${path} should handle storage read failures`);
    const loadSection = text.slice(catchIndex, catchIndex + 700);
    assert.match(loadSection, /persistenceBlocked:\s*true/, `${path} must not overwrite storage it failed to read`);
  }
});

test('all persisted domains surface write failures without converting them into corruption mode', () => {
  for (const path of [
    'src/hooks/usePersistentSchedules.js',
    'src/hooks/useScheduleTemplates.js',
    'src/hooks/useExperiments.js',
    'src/hooks/useReminderPreferences.js',
  ]) {
    const text = source(path);
    assert.match(text, /writeFailed/);
    assert.match(text, /localStorage\.setItem/);
    assert.match(text, /writeFailed:\s*true/);
    assert.match(text, /storageProtection:\s*\{[^}]*writeFailed/s);
  }
});

test('app visibly warns about failed device persistence while keeping backup rescue available', () => {
  const app = source('src/App.jsx');
  const settings = source('src/components/SettingsModal.jsx');
  assert.match(app, /端末への保存に失敗しています/);
  assert.match(app, /再読み込みすると失われる可能性があります/);
  assert.match(app, /writeFailedDomains/);
  assert.match(settings, /const storageBlocked = Boolean\(storageProtection\?\.persistenceBlocked\)/);
  assert.doesNotMatch(settings, /storageBlocked = Boolean\([^\n]*writeFailed/);
});
