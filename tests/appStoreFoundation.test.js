import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('native iOS shell loads only the bundled web app and sends external links to the OS', () => {
  const text = source('ios/RealitySync/ViewController.swift');
  assert.match(text, /appendingPathComponent\("Web"/);
  assert.match(text, /loadFileURL\(indexURL, allowingReadAccessTo: root\)/);
  assert.match(text, /if url\.isFileURL/);
  assert.match(text, /UIApplication\.shared\.open\(url\)/);
});

test('iOS privacy manifest declares no tracking or collected data for the current local-only release', () => {
  const text = source('ios/RealitySync/PrivacyInfo.xcprivacy');
  assert.match(text, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.match(text, /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
  assert.match(text, /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
  assert.match(text, /<key>NSPrivacyAccessedAPITypes<\/key>\s*<array\/>/);
});

test('iOS release metadata includes versioning, launch screen and encryption declaration', () => {
  const plist = source('ios/RealitySync/Info.plist');
  const config = source('ios/Config/Base.xcconfig');
  assert.match(plist, /ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  assert.match(plist, /UILaunchStoryboardName<\/key>\s*<string>LaunchScreen<\/string>/);
  assert.match(config, /MARKETING_VERSION = 1\.0\.0/);
  assert.match(config, /CURRENT_PROJECT_VERSION = 1/);
  assert.match(config, /PRODUCT_BUNDLE_IDENTIFIER = com\.example\.realitysync/);
});

test('Xcode target copies a prebuilt local Vite bundle and contains no third-party package dependency', () => {
  const project = source('ios/RealitySync.xcodeproj/project.pbxproj');
  assert.match(project, /Copy bundled web app/);
  assert.match(project, /Missing dist\/index\.html/);
  assert.match(project, /ditto .*WEB_DIST.*WEB_TARGET/s);
  assert.doesNotMatch(project, /XCRemoteSwiftPackageReference/);
  assert.doesNotMatch(project, /packageProductDependencies/);
});

test('settings exposes privacy, terms, live support and destructive local deletion without hiding the delete scope', () => {
  const text = source('src/components/SettingsModal.jsx');
  assert.match(text, /プライバシーポリシー/);
  assert.match(text, /利用規約/);
  assert.match(text, /この端末のデータをすべて削除/);
  assert.match(text, /window\.confirm/g);
  assert.match(text, /onEraseAllData\(\)/);
  assert.match(text, /SUPPORT_PAGE_URL/);
});

test('unfinished browser notification control is hidden from the native App Store shell', () => {
  const text = source('src/components/SettingsModal.jsx');
  assert.match(text, /!isNativeShell && \(/);
  assert.match(text, /Web版のOS通知/);
  assert.match(text, /requestNotifications/);
  assert.doesNotMatch(text, /ネイティブ通知は現在準備中/);
});

test('application-level erase clears every RealitySync storage domain and resets normalized state', () => {
  const text = source('src/App.jsx');
  for (const storageKey of [
    'STORAGE_KEY',
    'LEGACY_STORAGE_KEY',
    'TEMPLATE_STORAGE_KEY',
    'REMINDER_STORAGE_KEY',
    'REMINDER_NOTIFIED_STORAGE_KEY',
    'EXPERIMENT_STORAGE_KEY',
  ]) {
    assert.match(text, new RegExp(storageKey));
  }
  assert.match(text, /replaceStore\(createEmptyScheduleStore\(\)\)/);
  assert.match(text, /replaceTemplates\(\[\]\)/);
  assert.match(text, /replaceExperiments\(\[\]\)/);
  assert.match(text, /replaceReminderPreferences\(DEFAULT_REMINDER_PREFERENCES\)/);
  assert.match(text, /window\.localStorage\.removeItem\(key\)/);
});

test('native file bundle never attempts PWA service worker registration', () => {
  const text = source('src/main.jsx');
  assert.match(text, /location\.protocol === 'https:'/);
  assert.match(text, /location\.protocol === 'http:'/);
  assert.match(text, /canUseWebServiceWorker/);
  assert.doesNotMatch(text, /location\.protocol === 'file:'/);
});

test('public privacy, terms and support documents exist and match the current local-only behavior', () => {
  const privacy = source('public/privacy.html');
  const terms = source('public/terms.html');
  const support = source('public/support.html');
  assert.match(privacy, /アカウント、広告、アクセス解析、トラッキング、クラウド同期/);
  assert.match(privacy, /この端末のデータをすべて削除/);
  assert.match(terms, /医療・診断用途ではありません/);
  assert.match(support, /個人情報を公開しないでください/);
  assert.match(support, /Reality-sync\/issues\/new/);
});

test('App Store icon is generated headlessly from source rather than relying on a committed release binary', () => {
  const contents = source('ios/RealitySync/Assets.xcassets/AppIcon.appiconset/Contents.json');
  const generator = source('scripts/generate-ios-icon.swift');
  const prepare = source('scripts/prepare-ios.sh');
  assert.match(contents, /AppIcon-1024\.png/);
  assert.match(generator, /let width = 1024/);
  assert.match(generator, /let height = 1024/);
  assert.match(generator, /CGContext\(/);
  assert.match(generator, /CGImageAlphaInfo\.noneSkipLast/);
  assert.match(generator, /CGImageDestinationCreateWithURL/);
  assert.match(generator, /UTType\.png\.identifier/);
  assert.doesNotMatch(generator, /NSGraphicsContext/);
  assert.doesNotMatch(generator, /NSBitmapImageRep/);
  assert.match(prepare, /generate-ios-icon\.swift/);
  assert.match(prepare, /npm run build/);
});

test('release checker blocks placeholder identity and verifies required App Store artifacts', () => {
  const text = source('scripts/check-app-store-readiness.mjs');
  assert.match(text, /bundleId\.includes\('example'\)/);
  assert.match(text, /Privacy Manifest/);
  assert.match(text, /Privacy Policy page/);
  assert.match(text, /Support page/);
  assert.match(text, /AppIcon-1024\.png/);
  assert.match(text, /process\.exit\(1\)/);
});

test('package exposes explicit iOS preparation and App Store readiness scripts', () => {
  const pkg = JSON.parse(source('package.json'));
  assert.equal(pkg.scripts['ios:prepare'], 'bash scripts/prepare-ios.sh');
  assert.equal(pkg.scripts['appstore:check'], 'node scripts/check-app-store-readiness.mjs');
});
