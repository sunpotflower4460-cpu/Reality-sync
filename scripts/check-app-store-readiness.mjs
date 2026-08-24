import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const warnings = [];

function required(relativePath, label = relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) failures.push(`${label} がありません: ${relativePath}`);
  return path;
}

const configPath = required('ios/Config/Base.xcconfig', 'iOS release config');
const projectPath = required('ios/RealitySync.xcodeproj/project.pbxproj', 'Xcode project');
const privacyManifestPath = required('ios/RealitySync/PrivacyInfo.xcprivacy', 'Privacy Manifest');
const privacyPagePath = required('public/privacy.html', 'Privacy Policy page');
const supportPagePath = required('public/support.html', 'Support page');
const termsPagePath = required('public/terms.html', 'Terms page');
const iconPath = resolve(root, 'ios/RealitySync/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png');
const distPath = resolve(root, 'dist/index.html');

if (existsSync(configPath)) {
  const config = readFileSync(configPath, 'utf8');
  const match = config.match(/^PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)$/m);
  const bundleId = match?.[1]?.trim() ?? '';
  if (!bundleId || bundleId.includes('example')) {
    failures.push('Bundle ID が仮値のままです。ios/Config/Base.xcconfig の PRODUCT_BUNDLE_IDENTIFIER をAppleで登録した値へ変更してください。');
  }
  if (!/^MARKETING_VERSION\s*=\s*\d+\.\d+\.\d+$/m.test(config)) {
    failures.push('MARKETING_VERSION を x.y.z 形式で設定してください。');
  }
  if (!/^CURRENT_PROJECT_VERSION\s*=\s*\d+$/m.test(config)) {
    failures.push('CURRENT_PROJECT_VERSION を整数で設定してください。');
  }
}

if (existsSync(privacyManifestPath)) {
  const manifest = readFileSync(privacyManifestPath, 'utf8');
  if (!manifest.includes('<key>NSPrivacyTracking</key>') || !manifest.includes('<false/>')) {
    failures.push('Privacy Manifest の tracking 宣言を確認してください。');
  }
}

for (const [path, label] of [
  [privacyPagePath, 'privacy.html'],
  [supportPagePath, 'support.html'],
  [termsPagePath, 'terms.html'],
]) {
  if (existsSync(path) && statSync(path).size < 300) failures.push(`${label} が短すぎます。提出前に実内容を確認してください。`);
}

if (!existsSync(iconPath)) {
  failures.push('AppIcon-1024.png がありません。macOSで npm run ios:prepare を実行してください。');
}
if (!existsSync(distPath)) {
  failures.push('dist/index.html がありません。npm run ios:prepare を実行してください。');
}

warnings.push('XcodeのSigning Team、App Store ConnectのSKU/カテゴリ/年齢レーティング/価格はリポジトリ外の設定です。');
warnings.push('Privacy Policy URL / Support URL は公開URLとして実際にアクセスできる状態を提出前に確認してください。');
warnings.push('Archiveは実機またはTestFlightで確認し、App Review用スクリーンショットを実機UIから作成してください。');

console.log('RealitySync App Store readiness');
console.log('');
for (const warning of warnings) console.log(`WARN  ${warning}`);
for (const failure of failures) console.log(`FAIL  ${failure}`);

if (failures.length > 0) {
  console.error(`\n${failures.length}件の提出ブロッカーがあります。`);
  process.exit(1);
}

console.log('\nRepository-level App Store checks passed.');
