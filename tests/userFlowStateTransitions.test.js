import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS, STORAGE_VERSION } from '../src/constants.js';
import { DEFAULT_REMINDER_PREFERENCES } from '../src/utils/reminder.js';
import {
  createPendingScheduleCopy,
  normalizeSchedule,
  recordedPlanForSchedule,
} from '../src/utils/schedule.js';
import { parseBackup, serializeBackup } from '../src/utils/backup.js';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function editedRecordedSchedule(overrides = {}) {
  return {
    id: 'recorded-1',
    time: '10:30',
    title: '現在の仕事',
    category: '仕事',
    duration: 80,
    plannedStress: 65,
    status: STATUS.AS_PLANNED,
    plannedSnapshot: {
      time: '09:00',
      title: '記録時の散歩',
      category: '運動',
      duration: 30,
      plannedStress: 25,
    },
    actualTitle: '',
    actualCategory: null,
    actualDuration: 32,
    actualStartTime: '09:05',
    actualStartDateKey: '2026-08-26',
    actualStress: 28,
    mood: null,
    ...overrides,
  };
}

test('record -> later plan edit keeps missing as-planned actual identity anchored to the recorded plan snapshot', () => {
  const normalized = normalizeSchedule(editedRecordedSchedule());
  const recordedPlan = recordedPlanForSchedule(normalized);

  assert.equal(recordedPlan.time, '09:00');
  assert.equal(recordedPlan.title, '記録時の散歩');
  assert.equal(recordedPlan.category, '運動');
  assert.equal(recordedPlan.duration, 30);
  assert.equal(recordedPlan.plannedStress, 25);
  assert.equal(normalized.actualTitle, '記録時の散歩');
  assert.equal(normalized.actualCategory, '運動');
  assert.equal(normalized.time, '10:30');
  assert.equal(normalized.title, '現在の仕事');
});

test('copying a previously recorded and later edited plan carries the current plan forward but strips all past reality', () => {
  const normalized = normalizeSchedule(editedRecordedSchedule({ actualTitle: '記録時の散歩', actualCategory: '運動' }));
  const copied = createPendingScheduleCopy(normalized, 'copy-1');

  assert.equal(copied.time, '10:30');
  assert.equal(copied.title, '現在の仕事');
  assert.equal(copied.category, '仕事');
  assert.equal(copied.duration, 80);
  assert.equal(copied.plannedStress, 65);
  assert.equal(copied.status, STATUS.PENDING);
  assert.equal(copied.plannedSnapshot, null);
  assert.equal(copied.actualTitle, '');
  assert.equal(copied.actualCategory, null);
  assert.equal(copied.actualDuration, null);
  assert.equal(copied.actualStartTime, null);
  assert.equal(copied.actualStartDateKey, null);
  assert.equal(copied.actualStress, null);
  assert.equal(copied.mood, null);
});

test('backup -> restore keeps current edited plan and immutable recorded-plan truth as separate facts', () => {
  const recorded = normalizeSchedule(editedRecordedSchedule({ actualTitle: '記録時の散歩', actualCategory: '運動' }));
  const text = serializeBackup({
    store: { version: STORAGE_VERSION, days: { '2026-08-26': [recorded] } },
    templates: [],
    experiments: [],
    reminderPreferences: DEFAULT_REMINDER_PREFERENCES,
  });
  const restored = parseBackup(text);

  assert.equal(restored.ok, true);
  const [schedule] = restored.data.scheduleStore.days['2026-08-26'];
  assert.equal(schedule.time, '10:30');
  assert.equal(schedule.title, '現在の仕事');
  assert.deepEqual(schedule.plannedSnapshot, {
    time: '09:00',
    title: '記録時の散歩',
    category: '運動',
    duration: 30,
    plannedStress: 25,
  });
  assert.equal(schedule.actualTitle, '記録時の散歩');
  assert.equal(schedule.actualCategory, '運動');
});

test('reality timeline renders recorded rows from immutable plan facts instead of later plan edits', () => {
  const text = source('src/components/TrackView.jsx');
  assert.match(text, /recordedPlanForSchedule/);
  assert.match(text, /const planned = recorded \? recordedPlanForSchedule\(schedule\) : schedule/);
  assert.match(text, /const plannedTime = planned\?\.time \?\? schedule\.time/);
  assert.match(text, /予定負荷 \{plannedStress\}/);
  assert.match(text, /<time dateTime=\{`\$\{dateKey\}T\$\{plannedTime\}`\}>\{plannedTime\}<\/time>/);
  assert.match(text, /line-through">\{planned\.title\}/);
});

test('native App Store shell bridges backup files through iOS document pickers while the web fallback remains available', () => {
  const settings = source('src/components/SettingsModal.jsx');
  const native = source('ios/RealitySync/ViewController.swift');

  assert.match(settings, /realitySyncBackupExport/);
  assert.match(settings, /realitySyncBackupImport/);
  assert.match(settings, /realitysync:native-backup-import/);
  assert.match(settings, /realitysync:native-backup-status/);
  assert.match(settings, /if \(isNativeShell\)/);
  assert.match(settings, /new Blob\(\[text\]/);
  assert.match(settings, /fileInputRef\.current\?\.click\(\)/);

  assert.match(native, /WKScriptMessageHandler/);
  assert.match(native, /UIDocumentPickerDelegate/);
  assert.match(native, /UIDocumentPickerViewController\(forExporting:/);
  assert.match(native, /UIDocumentPickerViewController\(forOpeningContentTypes: \[\.json\], asCopy: true\)/);
  assert.match(native, /maximumBackupBytes = 10 \* 1024 \* 1024/);
  assert.match(native, /realitysync:native-backup-import/);
  assert.match(native, /realitysync:native-backup-status/);
});

test('native backup import checks file metadata before reading the selected file into memory', () => {
  const native = source('ios/RealitySync/ViewController.swift');
  const metadataCheck = native.indexOf('url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])');
  const byteRead = native.indexOf('Data(contentsOf: url, options: [.mappedIfSafe])');
  assert.ok(metadataCheck >= 0);
  assert.ok(byteRead > metadataCheck);
  assert.match(native, /fileSize <= Self\.maximumBackupBytes/);
});

test('native App Store shell presents JavaScript confirm calls through UIKit so destructive and replacement flows remain usable', () => {
  const native = source('ios/RealitySync/ViewController.swift');
  assert.match(native, /runJavaScriptConfirmPanelWithMessage/);
  assert.match(native, /UIAlertController\(title: "RealitySync", message: message, preferredStyle: \.alert\)/);
  assert.match(native, /UIAlertAction\(title: "キャンセル", style: \.cancel\)/);
  assert.match(native, /completionHandler\(false\)/);
  assert.match(native, /completionHandler\(true\)/);
  assert.match(native, /runJavaScriptAlertPanelWithMessage/);
});

test('native file navigation applies the same bundled-root boundary to normal and popup flows', () => {
  const native = source('ios/RealitySync/ViewController.swift');
  assert.match(native, /private func isBundledFileURL\(_ url: URL\) -> Bool/);
  assert.match(native, /candidatePath == rootPath \|\| candidatePath\.hasPrefix\(rootPath \+ "\/"\)/);
  assert.match(native, /decisionHandler\(isBundledFileURL\(url\) \? \.allow : \.cancel\)/);
  assert.match(native, /if isBundledFileURL\(url\) \{\s*webView\.load\(navigationAction\.request\)/s);
  assert.doesNotMatch(native, /if url\.isFileURL \{\s*webView\.load\(navigationAction\.request\)/s);
});

test('iOS icon generator is headless and emits an opaque CoreGraphics PNG', () => {
  const iconGenerator = source('scripts/generate-ios-icon.swift');
  assert.match(iconGenerator, /CGContext\(/);
  assert.match(iconGenerator, /CGImageAlphaInfo\.noneSkipLast/);
  assert.match(iconGenerator, /CGImageDestinationCreateWithURL/);
  assert.match(iconGenerator, /UTType\.png\.identifier/);
  assert.doesNotMatch(iconGenerator, /NSGraphicsContext/);
  assert.doesNotMatch(iconGenerator, /NSBitmapImageRep/);
});
