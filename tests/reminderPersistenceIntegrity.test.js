import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_REMINDER_PREFERENCES,
  parseStoredReminderPreferencesResult,
} from '../src/utils/reminder.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('missing reminder storage starts from valid defaults', () => {
  const result = parseStoredReminderPreferencesResult(null);
  assert.equal(result.ok, true);
  assert.deepEqual(result.preferences, DEFAULT_REMINDER_PREFERENCES);
});

test('valid reminder storage round-trips without protection mode', () => {
  const result = parseStoredReminderPreferencesResult(JSON.stringify({
    enabled: false,
    delayMinutes: 30,
    browserNotifications: true,
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.preferences, {
    enabled: false,
    delayMinutes: 30,
    browserNotifications: true,
  });
});

test('unknown reminder fields are protected from silent loss', () => {
  const result = parseStoredReminderPreferencesResult(JSON.stringify({
    enabled: true,
    delayMinutes: 15,
    browserNotifications: false,
    quietHours: { start: '22:00', end: '07:00' },
  }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.preferences, DEFAULT_REMINDER_PREFERENCES);
});

test('malformed reminder values cannot be silently replaced with defaults', () => {
  for (const preferences of [
    { enabled: 'false', delayMinutes: 15, browserNotifications: false },
    { enabled: true, delayMinutes: '15', browserNotifications: false },
    { enabled: true, delayMinutes: 999, browserNotifications: false },
    { enabled: true, delayMinutes: 15, browserNotifications: 1 },
  ]) {
    assert.equal(parseStoredReminderPreferencesResult(JSON.stringify(preferences)).ok, false);
  }
});

test('global protection mode includes malformed reminder storage', () => {
  const app = source('src/App.jsx');
  const hook = source('src/hooks/useReminderPreferences.js');
  assert.match(app, /storageProtection: reminderStorageProtection/);
  assert.match(app, /reminderStorageProtection\.persistenceBlocked/);
  assert.match(app, /protectedDomains\.push\('リマインダー設定'\)/);
  assert.match(hook, /if \(persistenceBlocked \|\| writeConflict \|\| !needsWrite\) return;/);
  assert.match(hook, /parseStoredReminderPreferencesResult\(event\.newValue\)/);
  assert.match(hook, /needsWrite: false/);
});
