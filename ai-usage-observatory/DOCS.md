# AI Usage Observatory — Add-on Documentation

## Overview

AI Usage Observatory is a self-hosted observability service for AI usage.
Applications continue to execute their own AI requests and POST telemetry afterward.
The Observatory stores events, calculates costs, and provides a functional web UI.

## First-time setup

1. Start the add-on.
2. Open the Web UI via the **Open Web UI** button (or `http://<ha-host>:8096`).
3. Navigate to **Applications**.
4. Create an application (give it a stable ID like `my-app` and a display name).
5. Create an API key for that application. Copy the key — it is shown only once.
6. Configure your client application with:
   - `AI_OBSERVATORY_URL=http://<ha-host>:8096`
   - `AI_OBSERVATORY_API_KEY=<your-key>`

## Configuration

```yaml
port: 8096
data_dir: /data
db_path: /data/observatory.sqlite
max_event_size_bytes: 1048576
max_artifact_size_bytes: 26214400
```

### `port`

Internal HTTP port used by the Node server.

Default: `8096`

Home Assistant Ingress and the published host port are configured for **8096**. Keep the default unless you also know how your direct port mapping and Ingress should behave.

### `data_dir`

Persistent data root inside the add-on container (artifact files live under `<data_dir>/artifacts`).

Default: `/data`

### `db_path`

SQLite database path inside the add-on container.

Default: `/data/observatory.sqlite`

Keeping the default preserves events and configuration across add-on restarts, upgrades, and Home Assistant backups.

### `max_event_size_bytes`

Maximum accepted JSON event payload size in bytes.

Default: `1048576` (1 MB)

### `max_artifact_size_bytes`

Maximum accepted artifact upload size in bytes.

Default: `26214400` (25 MB)

## Runtime behavior

- The add-on reads Home Assistant options from `/data/options.json` in `entrypoint.mjs`.
- The entrypoint exports `PORT`, `DATA_DIR`, `DB_PATH`, `MAX_EVENT_SIZE_BYTES`, and `MAX_ARTIFACT_SIZE_BYTES` before starting the server.
- Migrations run automatically before the HTTP server accepts traffic.

## Ingestion API

```
POST http://<ha-host>:8096/api/v1/events
Authorization: Bearer <api-key>
Content-Type: application/json
```

See the [API documentation](https://github.com/NikolausStoll/ai-observatory/blob/main/docs/api.md) for the full event schema.

## Pricing

Navigate to **Pricing** to add per-model pricing records.
Events ingested before pricing is added will be automatically repriced when pricing is saved.

## Health check

```
GET http://<ha-host>:8096/health
```

Returns `{"status":"ok","db":"ready","migrations":2}` when healthy.

## Persistent storage

Defaults:

- `/data/observatory.sqlite` — event and configuration database
- `/data/artifacts/` — uploaded artifact files

Home Assistant backups automatically include this data.

## Ports

- **8096** — Web UI and ingestion API (direct access; also the Ingress target)

## Supported architectures

- amd64
- aarch64
