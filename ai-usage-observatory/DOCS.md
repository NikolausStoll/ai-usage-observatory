# AI Usage Observatory — Add-on Documentation

## Overview

AI Usage Observatory is a self-hosted observability service for AI usage.
Applications continue to execute their own AI requests and POST telemetry afterward.
The Observatory stores events, calculates costs, and provides a functional web UI.

## First-time setup

1. Start the add-on.
2. Open the Web UI via the **Open Web UI** button.
3. Navigate to **Applications**.
4. Create an application (give it a stable ID like `my-app` and a display name).
5. Create an API key for that application. Copy the key — it is shown only once.
6. Configure your client application with:
   - `AI_OBSERVATORY_URL=http://<ha-host>:3000`
   - `AI_OBSERVATORY_API_KEY=<your-key>`

## Ingestion API

```
POST http://<ha-host>:3000/api/v1/events
Authorization: Bearer <api-key>
Content-Type: application/json
```

See the [API documentation](https://github.com/NikolausStoll/ai-observatory/blob/main/docs/api.md) for the full event schema.

## Pricing

Navigate to **Pricing** to add per-model pricing records.
Events ingested before pricing is added will be automatically repriced when pricing is saved.

## Health check

```
GET http://<ha-host>:3000/health
```

Returns `{"status":"ok","db":"ready","migrations":2}` when healthy.

## Persistent storage

All data is stored in the add-on `/data` directory:

- `/data/observatory.sqlite` — event and configuration database
- `/data/artifacts/` — uploaded artifact files

Home Assistant backups automatically include this data.

## Ports

- **3000** — Web UI and ingestion API (direct access, also used for Ingress)

## No additional configuration required

The add-on uses sensible defaults. No options need to be configured through Home Assistant.
