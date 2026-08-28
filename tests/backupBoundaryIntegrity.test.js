import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_FORMAT, BACKUP_VERSION, STORAGE_VERSION } from '../src/constants.js';
import { MAX_BACKUP_BYTES, parseBackup } from '../src/utils/backup.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function baseBackup(overrides = {}) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-08-28T00:00:00.000Z',
    scheduleStore: { version: STORAGE_VERSION, days: {} },
    templates: [],
    experiments: [],
    reminderPreferences: {},
    ...overrides,
  };
}

test('backup parser rejects unknown top-level metadata instead of silently discarding it', () => {
  const parsed = parseBackup(JSON.stringify(baseBackup({ futureMetadata: { keep: true } })));
  assert.equal(parsed.ok, false);
});

test('backup parser rejects unknown reminder fields instead of restoring a reduced preference set', () => {
  const parsed = parseBackup(JSON.stringify(baseBackup({
    reminderPreferences: { enabled: true, futureReminderMode: 'keep-me' },
  })));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /リマインダー設定/);
});

test('backup parser rejects payloads above the shared 10MB boundary before JSON parsing', () => {
  const oversized = 'x'.repeat(MAX_BACKUP_BYTES + 1);
  const parsed = parseBackup(oversized);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /10MB以下/);
});

test('web backup import checks File.size before calling file.text', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const sizeCheck = settings.indexOf('file.size > MAX_BACKUP_BYTES');
  const textRead = settings.indexOf('await file.text()');
  assert.ok(sizeCheck >= 0);
  assert.ok(textRead > sizeCheck);
  assert.match(settings, /MAX_BACKUP_BYTES/);
});

test('backup export refuses an oversized payload before native handoff or Blob download', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const serialized = settings.indexOf('const text = serializeBackup');
  const sizeCheck = settings.indexOf('byteLength > MAX_BACKUP_BYTES');
  const nativeHandoff = settings.indexOf('if (isNativeShell)', serialized);
  const blobCreation = settings.indexOf('new Blob([text]', serialized);
  assert.ok(serialized >= 0);
  assert.ok(sizeCheck > serialized);
  assert.ok(nativeHandoff > sizeCheck);
  assert.ok(blobCreation > sizeCheck);
});
