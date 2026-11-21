#!/bin/sh
# Build the Rust Brain core, then the Mac app, and wrap it as build/Nous.app.
set -eu
cd "$(dirname "$0")"
CARGO="${CARGO:-$HOME/.cargo/bin/cargo}"

(cd ../../brain-rs && "$CARGO" build --release)
swift build -c release

APP=build/Nous.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp .build/release/NousMac "$APP/Contents/MacOS/Nous"
cp Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP" >/dev/null   # ad-hoc: runs on this Mac only, not distributable
echo "Built $APP"
