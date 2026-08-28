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
