# RealitySync — App Store metadata draft (JA)

This file is a release draft, not evidence that App Store Connect has already been configured.

## Product positioning

RealitySync is not an optimization dashboard or medical app.

Core promise:

> 理想の予定と、実際の1日を見比べる。ズレを責めずに記録して、次の予定を少し現実に近づける。

## Suggested metadata

### App name

RealitySync

### Subtitle

理想と現実を比べる生活記録

### Primary category

Productivity / 仕事効率化

This is a proposed release category. Confirm it in App Store Connect before submission.

### Description draft

予定通りにできなかった日を、「失敗」で終わらせないための記録アプリです。

RealitySyncでは、まず「こう過ごしたい」という理想の予定を置きます。
そして実際には何時ごろ始めたか、どのくらい時間がかかったか、負荷や気分はどうだったかを記録します。

記録がたまると、理想と現実の違いをシンプルに見比べられます。

- 理想のスケジュールを作成
- 予定通り / 変更 / 休んだ、を簡単に記録
- 想定した負荷と実際の負荷を比較
- 理想の時間配分と現実の時間配分を確認
- 前の記録から、次の予定を少し現実的にするヒントを表示
- JSONバックアップ / 復元

RealitySyncは、未記録の行動を予定から推測しません。
「予定では60分だったから、実際も60分だったはず」といった補完はせず、記録した現実だけを扱います。

現行版はアカウント不要です。
予定や実績は端末内に保存され、広告・アクセス解析・トラッキング・クラウド同期は利用しません。

※ RealitySyncは医療・診断・治療を目的とするアプリではありません。

### Promotional text draft

予定と現実のズレを、失敗ではなく次の計画に使える記録へ。

### Keywords draft

予定,生活記録,時間管理,振り返り,習慣,スケジュール,自己管理,日記

Final keyword length/format must be checked in App Store Connect.

## Privacy / support URL candidates

These are **candidates only until actually deployed and verified**:

- Privacy Policy: `https://sunpotflower4460-cpu.github.io/Reality-sync/privacy.html`
- Support page: `https://sunpotflower4460-cpu.github.io/Reality-sync/support.html`

Until the support page is deployed, the in-app support action uses:

- `https://github.com/sunpotflower4460-cpu/Reality-sync/issues`

Do not submit a URL that returns 404 or requires repository access.

## App Privacy draft

For the current release architecture only:

- Account: none
- Ads: none
- Tracking: none
- Analytics: none
- Cloud sync: none
- Developer backend receiving user schedules/reality: none
- Data stored locally on device: yes
- User-initiated exported JSON backup: yes

This currently supports an App Store privacy answer of **Data Not Collected** only if the final binary preserves these behaviors.

Review again after every SDK/network/data-flow change.

## App Review notes draft

RealitySync is a local-first planning and reflection app.

- No login or review account is required.
- The app's main interface is bundled inside the iOS application and works without loading a remote website.
- User schedule/reality data is stored locally on the device.
- There is no advertising, tracking, analytics SDK or cloud synchronization in this release.
- Backup export/import is user initiated.
- The app does not provide medical diagnosis or treatment.
- Missing reality data is not inferred from planned values.

Reviewer path:

1. Open `計画` and add a schedule.
2. Open `記録` and record what actually happened.
3. Open `分析` to compare ideal and reality.
4. Open settings for privacy policy, terms, backup and local-data deletion.

## Screenshot plan

Capture from the actual App Store/TestFlight binary, not from a mockup-only implementation.

Suggested first screenshot sequence:

1. 計画 — 理想の1日を置く
2. 記録 — 予定と実際を並べて残す
3. 負荷の波 — 想定と実際を見比べる
4. 分析 — 理想の軌跡 vs 現実の歩み
5. 気づき — 次の予定を少し現実に近づける

Final device sizes and screenshot sets must follow the current App Store Connect requirements at submission time.

## Manual App Store Connect decisions still required

- final Bundle ID / App ID
- SKU
- pricing model
- availability territories
- age rating questionnaire
- category confirmation
- copyright / seller details
- trader status / regional compliance where applicable
- final Support URL and Privacy URL
- screenshots
- release method and review submission
