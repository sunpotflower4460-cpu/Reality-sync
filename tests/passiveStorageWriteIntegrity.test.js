import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('persistent hooks do not write merely because they mounted or received an external storage event', () => {
  for (const path of [
    'src/hooks/usePersistentSchedules.js',
    'src/hooks/useScheduleTemplates.js',
    'src/hooks/useExperiments.js',
    'src/hooks/useReminderPreferences.js',
  ]) {
    const text = source(path);
    assert.match(text, /needsWrite/);
    assert.match(text, /!needsWrite\) return/);
    assert.match(text, /needsWrite:\s*false/);
    assert.match(text, /needsWrite:\s*true/);
  }
});

test('known legacy stores still opt into the one required migration write', () => {
  const schedules = source('src/hooks/usePersistentSchedules.js');
  const experiments = source('src/hooks/useExperiments.js');
  assert.match(schedules, /needsWrite:\s*Boolean\(legacyRaw\) && migration\.ok/);
  assert.match(experiments, /raw\.trimStart\(\)\.startsWith\('\['\)/);
});

test('successful primary schedule persistence is read-back verified and committed before best-effort legacy cleanup', () => {
  const schedules = source('src/hooks/usePersistentSchedules.js');
  const write = schedules.indexOf('window.localStorage.setItem(STORAGE_KEY');
  const readBack = schedules.indexOf('const readBack = parseStoredScheduleStoreResult(window.localStorage.getItem(STORAGE_KEY))', write);
  const verifiedComment = schedules.indexOf('The primary versioned store is read-back verified at this point.', readBack);
  const stateCommit = schedules.indexOf('applyState((current) => {', verifiedComment);
  const legacyCleanup = schedules.indexOf('window.localStorage.removeItem(LEGACY_STORAGE_KEY)', stateCommit);
  const cleanupCatch = schedules.indexOf('Legacy data is ignored whenever the versioned store exists.', legacyCleanup);
  assert.ok(write >= 0);
  assert.ok(readBack > write);
  assert.ok(verifiedComment > readBack);
  assert.ok(stateCommit > verifiedComment);
  assert.ok(legacyCleanup > stateCommit);
  assert.ok(cleanupCatch > legacyCleanup);
});

test('backup restore and erase state replacements do not echo whole-store writes', () => {
  const schedules = source('src/hooks/usePersistentSchedules.js');
  const templates = source('src/hooks/useScheduleTemplates.js');
  const experiments = source('src/hooks/useExperiments.js');
  const reminders = source('src/hooks/useReminderPreferences.js');
  assert.match(schedules, /replaceStore[\s\S]*needsWrite:\s*false/);
  assert.match(templates, /replaceTemplates[\s\S]*needsWrite:\s*false/);
  assert.match(experiments, /replaceExperiments[\s\S]*needsWrite:\s*false/);
  assert.match(reminders, /replacePreferences[\s\S]*needsWrite:\s*false/);
});
