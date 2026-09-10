# AI Usage Observatory

Central observability service for AI usage across private applications. Applications report telemetry after each AI provider call. The Observatory stores, prices, and displays that data — it does not proxy or control AI calls.

## Quick start

```bash
npm install
# Create first application and API key (prints plaintext key)
npm run seed my-app "My App" my-key
# Start dev server
npm run dev
# Open http://localhost:3000
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Path to persistent data directory (SQLite + artifacts) |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | — | `production` / `development` / `test` |
| `MAX_EVENT_SIZE_BYTES` | `1048576` (1 MB) | Maximum event payload size |
| `MAX_ARTIFACT_SIZE_BYTES` | `26214400` (25 MB) | Maximum artifact upload size |

## Data layout

```
<DATA_DIR>/
  observatory.sqlite     # SQLite database
  artifacts/             # Artifact binaries
```

## Docker (production)

```bash
docker build -t ai-observatory .

# Named volume (Docker-managed)
docker run -p 3000:3000 -v observatory-data:/data ai-observatory

# Host bind-mount (Home Assistant style)
# The container entrypoint chowns /data before dropping to the app user.
# No manual chown required on the host.
mkdir -p /path/to/data
docker run -p 3000:3000 -v /path/to/data:/data ai-observatory
```

### docker-compose

```yaml
services:
  observatory:
    image: ai-observatory
    build: .
    ports:
      - "3000:3000"
    volumes:
      - observatory-data:/data
    environment:
      - DATA_DIR=/data
      - NODE_ENV=production

volumes:
  observatory-data:
```

## Health check

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"ready","migrations":2}
```

Returns HTTP 200 on healthy, 503 on error.

## Initial setup

After starting for the first time, create an application and API key:

```bash
# In the container
docker exec <container> node -e "
  import Database from 'better-sqlite3';
  import { createHash, randomBytes } from 'crypto';
  const db = new Database(process.env.DATA_DIR + '/observatory.sqlite');
  const key = 'obs_' + randomBytes(32).toString('hex');
  db.prepare('INSERT OR IGNORE INTO applications (id, display_name, created_at) VALUES (?,?,?)').run('my-app','My App',new Date().toISOString());
  db.prepare('INSERT INTO api_keys (id, application_id, name, key_hash, created_at) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),'my-app','default-key',createHash('sha256').update(key).digest('hex'),new Date().toISOString());
  console.log('API key:', key);
" --input-type=module
```

Or locally: `npm run seed my-app "My App" default-key`

You can also create applications and keys through the UI at `/applications`.

## Reporting events

```bash
curl -X POST http://localhost:3000/api/v1/events \
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
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm test             # Vitest test suite
npm run seed         # Create app + API key
```
