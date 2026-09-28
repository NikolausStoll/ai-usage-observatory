# AI Usage Observatory

Central observability service for AI usage across private applications. Applications report telemetry after each AI provider call. The Observatory stores, prices, and displays that data — it does not proxy or control AI calls.

## Local development

```bash
npm ci
cp .env.example .env        # adjust values if needed
npm run seed my-app "My App" my-key   # create first app + API key (prints key)
npm run dev                 # start dev server at http://localhost:8096
```

`.env` is loaded automatically by Vite in dev mode. See `.env.example` for all supported variables.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8096` | HTTP port |
| `DATA_DIR` | `./data` | Persistent data directory (artifacts; also default DB parent) |
| `DB_PATH` | `<DATA_DIR>/observatory.sqlite` | SQLite database file path |
| `MAX_EVENT_SIZE_BYTES` | `1048576` (1 MB) | Maximum event payload size |
| `MAX_ARTIFACT_SIZE_BYTES` | `26214400` (25 MB) | Maximum artifact upload size |
| `NODE_ENV` | `development` | Runtime environment |

`.env` must not be committed — it is gitignored. `.env.example` documents all variables with safe defaults.

## Data layout

```
<DATA_DIR>/
  observatory.sqlite     # SQLite database (default path; overridable via DB_PATH)
  artifacts/             # Artifact binaries (auto-created)
```

Migrations run automatically at startup before any traffic is served.

## Docker (production / local)

```bash
docker build -t ai-usage-observatory .

# Named volume
docker run -p 8096:8096 -v observatory-data:/data ai-usage-observatory

# Host bind-mount (Home Assistant style)
# The entrypoint chowns /data before dropping to the app user — no manual chown needed.
mkdir -p /path/to/data
docker run -p 8096:8096 -v /path/to/data:/data ai-usage-observatory
```

### docker-compose

```yaml
services:
  observatory:
    build: .
    ports:
      - "8096:8096"
    volumes:
      - observatory-data:/data
    environment:
      - NODE_ENV=production
volumes:
  observatory-data:
```

## Home Assistant Add-on

The `ai-usage-observatory/` directory contains the Home Assistant Add-on packaging.

To install:
1. In Home Assistant → Settings → Add-ons → Add-on Store → ⋮ → Repositories
2. Add `https://github.com/NikolausStoll/ai-usage-observatory`
3. Install **AI Usage Observatory**
4. Start the add-on and open the Web UI

The add-on exposes port **8096** directly for API ingestion from client applications. Persistent data lives in Home Assistant's `/data` directory and is included in HA backups.

Configurable add-on options (defaults shown):

| Option | Default | Description |
|---|---|---|
| `port` | `8096` | HTTP listen port (keep default unless you also adjust Ingress/port mapping) |
| `data_dir` | `/data` | Persistent data root for artifacts |
| `db_path` | `/data/observatory.sqlite` | SQLite database path |
| `max_event_size_bytes` | `1048576` | Max event payload size |
| `max_artifact_size_bytes` | `26214400` | Max artifact upload size |

## Health check

```bash
curl http://localhost:8096/health
# {"status":"ok","db":"ready","migrations":2}
```

Returns HTTP 200 when healthy, 503 on error.

## API

```bash
curl -X POST http://localhost:8096/api/v1/events \
  -H "Authorization: Bearer obs_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "<uuid>",
    "timestamp": "2026-09-10T12:00:00.000Z",
    "durationMs": 1500,
    "environment": "production",
    "feature": "my-feature",
    "operation": "my-operation",
    "operationId": "my-feature:123:my-operation",
    "attemptNumber": 1,
    "status": "success",
    "provider": "anthropic",
    "requestedModel": "claude-sonnet-4-6",
    "usage": { "inputTokens": 1000, "outputTokens": 500 }
  }'
```

See [docs/api.md](docs/api.md) for the full API reference.

## Development commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm test             # test suite
npm run seed         # create app + API key
```

## Releases

On every push to `main`, GitHub Actions runs tests and typecheck. When those pass **and** `ai-usage-observatory/config.yaml` `version` changed, the workflow creates a matching git tag and publishes `ghcr.io/nikolausstoll/ai-usage-observatory:<version>` (plus `:latest`).
