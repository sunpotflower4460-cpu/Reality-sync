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

test('notification key is reserved before awaiting OS display to close rerender races', () => {
  const hook = source('src/hooks/useDueRecordReminders.js');
  const reserve = hook.indexOf('sessionNotifiedRef.current.add(key)');
  const display = hook.indexOf('await showBrowserNotification(schedule, sourceDateKey)', reserve);
  const persist = hook.indexOf('writeNotifiedKeys([...notified])', display);
  assert.ok(reserve >= 0, 'notification key should be reserved');
  assert.ok(display > reserve, 'reservation must happen before asynchronous display');
  assert.ok(persist > display, 'persistent dedupe should only be written after a shown notification');
});
