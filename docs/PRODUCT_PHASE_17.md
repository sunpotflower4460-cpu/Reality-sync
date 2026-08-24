# Product Phase 17 — App Store Release Foundation

## Goal

Prepare RealitySync for a commercial iOS/App Store release without expanding the product concept.

The user-facing product remains:

1. make an ideal plan,
2. record what actually happened,
3. compare ideal and reality,
4. use the gap to make the next plan a little more realistic.

Phase 17 adds release infrastructure, privacy/legal surfaces, and release safety checks only.

## Native iOS architecture

RealitySync now has an iPhone Xcode target under `ios/`.

The target uses only Apple frameworks:

- UIKit
- WebKit (`WKWebView`)

There is no Capacitor, analytics SDK, ad SDK, account SDK, cloud SDK, or remote app URL.

The production Vite build is copied into the signed app bundle as `Web/`, and the native shell loads only that bundled `index.html` with `loadFileURL`.

HTTP/HTTPS/mail links are handed to the operating system instead of replacing the bundled app UI.

This keeps the existing React product while making the App Store binary independently runnable offline rather than a remote-website wrapper.

## Privacy / data behavior for the current release

Current RealitySync behavior is local-only:

- schedules and recorded reality stay on the device
- load, mood, reasons and timing stay on the device
- templates and internal learning history stay on the device
- there is no RealitySync account
- there is no advertising
- there is no tracking
- there is no analytics SDK
- there is no cloud sync
- there is no developer backend receiving schedule/reality data
- backup JSON is created only when the user explicitly exports it

The iOS target includes `PrivacyInfo.xcprivacy` with tracking disabled and no collected-data declarations for this release.

If any SDK, analytics, cloud sync, login, crash reporting, or server transmission is added later, the manifest, privacy policy, App Store privacy answers and potentially consent flow must be reviewed again before release.

## In-app commercial/legal surface

`設定とデータ` now contains:

- in-app Privacy Policy
- in-app Terms
- an external support route
- app version
- explicit local data deletion

Local deletion uses two confirmations and clears:

- schedule/reality store
- legacy schedule storage
- templates
- experiment/internal learning history
- reminder preferences
- reminder notification dedupe data

Exported backup files are not silently deleted because they are outside RealitySync's local storage ownership.

## Public web documents

The repository now contains:

- `public/privacy.html`
- `public/terms.html`
- `public/support.html`

They are suitable source documents for App Store metadata URLs once deployed to a real public HTTPS location.

The repository currently contains GitHub Pages URL candidates, but Phase 17 does **not** claim that GitHub Pages has been enabled or that those URLs are live.

The in-app Support action therefore continues to use the already-live public GitHub Issues channel until a dedicated support page is deployed and verified.

## iOS release configuration

`ios/Config/Base.xcconfig` centralizes:

- product name
- Bundle ID
- marketing version
- build number
- iPhone deployment target
- Swift version
- signing mode
- AppIcon asset

The Bundle ID is deliberately set to the release-blocking placeholder:

`com.example.realitysync`

It must be replaced with the App ID registered in the user's Apple Developer account before the first App Store upload.

It is not safe for the repository to guess the final Bundle ID because it becomes an external App Store identity decision.

## Icon / launch assets

The App Store icon is generated deterministically on macOS by:

```bash
npm run ios:prepare
```

The script:

1. builds the Vite app,
2. generates a 1024x1024 opaque AppIcon PNG,
3. verifies the built web bundle and icon exist.

The generated PNG is ignored by Git because it is a build artifact. The design source is `scripts/generate-ios-icon.swift`.

A simple native launch screen is included.

## Release check

Run:

```bash
npm run appstore:check
```

The check intentionally fails while release blockers remain, including:

- placeholder Bundle ID
- missing built web bundle
- missing generated AppIcon
- missing Xcode project
- missing privacy manifest
- missing privacy/support/terms documents

It also reminds the releaser that some requirements are outside the repository.

## External/manual release gates

Phase 17 does **not** claim App Store submission readiness until all of the following have been completed and verified:

- final Bundle ID registered in Apple Developer and written to `Base.xcconfig`
- Apple signing Team selected in Xcode
- Xcode project successfully compiles on current macOS/Xcode
- archive succeeds for a physical iPhone target
- real-device behavior is checked
- TestFlight build is installed and checked
- privacy policy URL is publicly reachable over HTTPS
- support URL is publicly reachable and provides a usable contact route
- any jurisdiction-required business/legal contact information is supplied
- App Store Connect privacy answers match the actual release binary
- age rating questionnaire is completed
- category, pricing and territories are chosen
- screenshots are captured from the actual app
- App Review notes are completed

## Known next iOS integration work

The current web backup and browser-notification APIs still need explicit iOS-device verification.

A following release-readiness phase should prioritize:

1. native backup export/import through the iOS share/document picker if WKWebView download/upload behavior is insufficient,
2. native local notifications if closed-app reminder delivery is part of the commercial v1 promise,
3. TestFlight and real-device validation,
4. final App Store Connect metadata/assets.

Those are release-support tasks, not new RealitySync product concepts.
