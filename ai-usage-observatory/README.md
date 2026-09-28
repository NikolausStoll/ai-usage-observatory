# AI Usage Observatory

Observability and cost analysis for AI usage across private applications.

## What it does

Central service to inspect AI calls, token usage, estimated costs, latency, prompts, and artifacts. Applications POST telemetry after AI calls; the Observatory stores and displays it.

## Setup

1. Install and start the add-on.
2. Open the Web UI via the **Open Web UI** button.
3. Go to **Applications** → create an application → create an API key.
4. Configure your client application with the key and the direct API port.

## API ingestion

Client applications POST events to:

```
http://<ha-host>:3000/api/v1/events
Authorization: Bearer <api-key>
```

## Persistent data

SQLite database and artifact files are stored in `/data` (Home Assistant's persistent add-on data directory). Home Assistant backups include this data automatically.

## Supported architectures

- amd64
- aarch64
- armv7
