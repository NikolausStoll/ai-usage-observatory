# Branding assets

Source artwork for AI Usage Observatory icons lives here. Generated raster
variants used by the web app and Home Assistant add-on are committed under
`public/` and `ai-usage-observatory/icon.png`.

## Sources

| File | Role |
|---|---|
| `source/app-icon.jpg` / `source/app-icon.png` | Primary app / PWA / HA icon |
| `source/favicon-source.jpg` / `source/favicon-source.png` | Simplified silhouette for favicons |

## Regenerate

On macOS (uses `sips`, no npm image dependency):

```bash
# If only JPEGs are present, convert once:
sips -s format png branding/source/app-icon.jpg --out branding/source/app-icon.png
sips -s format png branding/source/favicon-source.jpg --out branding/source/favicon-source.png

chmod +x scripts/generate-branding-icons.sh
./scripts/generate-branding-icons.sh
```

Do not add a runtime image-processing dependency for this.

## PWA installability

Besides the web app manifest (`public/manifest.webmanifest`) and icons,
Chromium still expects a registered **service worker with a `fetch` handler**
for a reliable install affordance (Recipe Library does the same via `public/sw.js`).

Observatory pieces:

| File | Role |
|---|---|
| `public/manifest.webmanifest` | name, icons 192/512, `start_url`/`scope`, `display: standalone` |
| `public/sw.js` | Minimal shell cache + fetch handler (ingress-safe relative scope) |
| `src/routes/__root.tsx` | Registers `sw.js` via `assetUrl` (works under HA Ingress) |

Serve over HTTPS (or localhost). API traffic under `/api/` is not intercepted by the SW.
