#!/usr/bin/env bash
# One-shot regenerator for Observatory branding icons (macOS sips).
# Does not run in CI or at app runtime — commit the generated public/ assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_APP="$ROOT/branding/source/app-icon.png"
SRC_FAV="$ROOT/branding/source/favicon-source.png"
PAD_COLOR="001030"

if [[ ! -f "$SRC_APP" || ! -f "$SRC_FAV" ]]; then
  echo "Missing branding/source PNGs. Convert branding/source/*.jpg first." >&2
  exit 1
fi

mkdir -p "$ROOT/public/icons"

sips -z 192 192 "$SRC_APP" --out "$ROOT/public/icons/icon-192.png" >/dev/null
sips -z 512 512 "$SRC_APP" --out "$ROOT/public/icons/icon-512.png" >/dev/null
sips -z 180 180 "$SRC_APP" --out "$ROOT/public/apple-touch-icon.png" >/dev/null

tmp="$(mktemp -t obs-maskable)"
sips -z 410 410 "$SRC_APP" --out "$tmp.png" >/dev/null
sips -p 512 512 --padColor "$PAD_COLOR" "$tmp.png" --out "$ROOT/public/icons/icon-512-maskable.png" >/dev/null
rm -f "$tmp.png"

sips -z 512 512 "$SRC_APP" --out "$ROOT/ai-usage-observatory/icon.png" >/dev/null

sips -z 16 16 "$SRC_FAV" --out "$ROOT/public/favicon-16x16.png" >/dev/null
sips -z 32 32 "$SRC_FAV" --out "$ROOT/public/favicon-32x32.png" >/dev/null
sips -z 48 48 "$SRC_FAV" --out "$ROOT/public/favicon-48x48.png" >/dev/null
sips -s format ico -z 32 32 "$SRC_FAV" --out "$ROOT/public/favicon.ico" >/dev/null || \
  sips -z 32 32 "$SRC_FAV" --out "$ROOT/public/favicon.ico" >/dev/null

echo "Branding icons regenerated under public/ and ai-usage-observatory/icon.png"
