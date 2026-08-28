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

test('successful primary schedule persistence is committed before best-effort legacy cleanup', () => {
  const schedules = source('src/hooks/usePersistentSchedules.js');
  const write = schedules.indexOf('window.localStorage.setItem(STORAGE_KEY');
  const commitComment = schedules.indexOf('The primary versioned store is already durable at this point.', write);
  const stateCommit = schedules.indexOf('applyState((current) => {', commitComment);
  const legacyCleanup = schedules.indexOf('window.localStorage.removeItem(LEGACY_STORAGE_KEY)', stateCommit);
  const cleanupCatch = schedules.indexOf('Legacy data is ignored whenever the versioned store exists.', legacyCleanup);
  assert.ok(write >= 0);
  assert.ok(commitComment > write);
  assert.ok(stateCommit > commitComment);
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
