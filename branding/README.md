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
