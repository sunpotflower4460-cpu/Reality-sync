#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: iOS preparation must run on macOS with Xcode installed." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "error: Xcode command line tools were not found." >&2
  exit 1
fi

npm run build

ICON_PATH="$ROOT_DIR/ios/RealitySync/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
xcrun swift "$ROOT_DIR/scripts/generate-ios-icon.swift" "$ICON_PATH"

if [[ ! -f "$ROOT_DIR/dist/index.html" ]]; then
  echo "error: dist/index.html was not created." >&2
  exit 1
fi

if [[ ! -s "$ICON_PATH" ]]; then
  echo "error: AppIcon-1024.png was not generated." >&2
  exit 1
fi

echo "RealitySync iOS assets are prepared."
echo "Open ios/RealitySync.xcodeproj in Xcode, set Signing Team / final Bundle ID, then archive."
