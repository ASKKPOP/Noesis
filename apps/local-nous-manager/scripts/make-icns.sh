#!/usr/bin/env bash
# Generate assets/icon.icns from the canonical Noēsis mark (dashboard/public/forest-icon.svg).
# macOS-only: Swift/AppKit rasterizes the SVG; sips + iconutil assemble the icns.
# (assets/, not build/ — the repo root .gitignore excludes build/ globally.)
set -euo pipefail
cd "$(dirname "$0")/.."

SVG="../../dashboard/public/forest-icon.svg"
OUT="assets/icon.icns"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/render.swift" <<'EOF'
import AppKit
let svg = CommandLine.arguments[1], out = CommandLine.arguments[2]
guard let img = NSImage(contentsOfFile: svg) else { fatalError("cannot read \(svg)") }
// Apple icon grid: artwork ~824pt inside a 1024pt canvas, transparent margin.
let canvas = 1024, content = 824
guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: canvas, pixelsHigh: canvas,
  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { fatalError("bitmap rep") }
rep.size = NSSize(width: canvas, height: canvas)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let o = CGFloat((canvas - content) / 2)
img.draw(in: NSRect(x: o, y: o, width: CGFloat(content), height: CGFloat(content)),
         from: .zero, operation: .sourceOver, fraction: 1.0)
NSGraphicsContext.restoreGraphicsState()
guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("png encode") }
try! png.write(to: URL(fileURLWithPath: out))
EOF
swift "$TMP/render.swift" "$SVG" "$TMP/icon_1024.png"

ICONSET="$TMP/AppIcon.iconset"
mkdir -p "$ICONSET" build
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$TMP/icon_1024.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$TMP/icon_1024.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$OUT"
echo "wrote $OUT"
