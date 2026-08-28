import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('browser reminder dedupe remains session-safe when localStorage cannot persist keys', () => {
  const hook = source('src/hooks/useDueRecordReminders.js');
  assert.match(hook, /useRef\(new Set\(\)\)/);
  assert.match(hook, /sessionNotifiedRef\.current = new Set\(sessionKeys\)/);
  assert.match(hook, /sessionNotifiedRef\.current\.delete\(key\)/);
});

test('notification key is reserved before awaiting OS display and persisted only after a shown notification', () => {
  const hook = source('src/hooks/useDueRecordReminders.js');
  const reserve = hook.indexOf('sessionNotifiedRef.current.add(key)');
  const display = hook.indexOf('await showBrowserNotification(schedule, sourceDateKey)', reserve);
  const shownGuard = hook.indexOf('if (!shown)', display);
  const persist = hook.indexOf('writeNotifiedKeys([...notified], retainedDateKeys)', shownGuard);
  assert.ok(reserve >= 0, 'notification key should be reserved');
  assert.ok(display > reserve, 'reservation must happen before asynchronous display');
  assert.ok(shownGuard > display, 'failed OS display must be handled before persistence');
  assert.ok(persist > shownGuard, 'persistent dedupe should only be written after a shown notification');
});

test('cross-tab reminder dedupe merges retained remote keys and verifies the merged write', () => {
  const hook = source('src/hooks/useDueRecordReminders.js');
  const start = hook.indexOf('function writeNotifiedKeys');
  const end = hook.indexOf('function readSchedulesForDate', start);
  const block = hook.slice(start, end);
  assert.match(block, /window\.localStorage\.getItem\(REMINDER_NOTIFIED_STORAGE_KEY\)/);
  assert.match(block, /const merged = \[\.\.\.new Set\(\[\.\.\.latest, \.\.\.keys\]\)\]/);
  assert.match(block, /window\.localStorage\.setItem\(REMINDER_NOTIFIED_STORAGE_KEY, JSON\.stringify\(merged\)\)/);
  assert.match(block, /const readBack = normalizedStoredNotificationKeys/);
  assert.match(block, /return merged\.every\(\(key\) => readBack\.includes\(key\)\)/);
});

test('cross-midnight carryover notifications retain the previous-day dedupe key for the whole notification pass', () => {
  const hook = source('src/hooks/useDueRecordReminders.js');
  assert.match(hook, /const retainedDateKeys = \[todayKey, previousDateKey\]/);
  assert.match(hook, /normalizeNotifiedReminderKeys\(\[\.\.\.sessionNotifiedRef\.current\], key\)/);
  assert.match(hook, /readNotifiedKeys\(retainedDateKeys\)/);
  assert.match(hook, /writeNotifiedKeys\(\[\.\.\.notified\], retainedDateKeys\)/);
  assert.match(hook, /reminderNotificationKey\(sourceDateKey, schedule\.id\)/);
});
