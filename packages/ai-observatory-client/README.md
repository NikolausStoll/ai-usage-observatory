# `@nikolausstoll/ai-observatory-client`

Fire-and-forget Node client for [AI Usage Observatory](https://github.com/NikolausStoll/ai-usage-observatory) event ingestion (`POST /api/v1/events`).

Missing `AI_OBSERVATORY_URL` / `AI_OBSERVATORY_API_KEY` (or explicit options) disables the client — calls become no-ops. Network and HTTP failures are logged and never thrown to the caller.

## Install

Prefer a release tarball (no registry auth):

```bash
npm install https://github.com/NikolausStoll/ai-usage-observatory/releases/download/client-v0.1.0/ai-observatory-client-0.1.0.tgz
```

Local checkout:

```bash
npm install /path/to/ai-usage-observatory/packages/ai-observatory-client
```

## Usage

```js
import {
  createObservatoryClient,
  buildEvent,
} from "@nikolausstoll/ai-observatory-client";

const client = createObservatoryClient(); // reads AI_OBSERVATORY_URL + AI_OBSERVATORY_API_KEY

client.reportEvent({
  feature: "recipe-import",
  operation: "image-extraction",
  operationId: "recipe-import:123:image-extraction",
  status: "success",
  provider: "openai",
  requestedModel: "gpt-4o-mini",
  durationMs: 1843,
  usage: {
    inputTokens: 1200,
    outputTokens: 300,
    totalTokens: 1500,
  },
  metadata: { recipeId: 123 },
});
```

Or build the payload yourself and call `report` / `postEvent`:

```js
const event = buildEvent({ /* ... */ });
client.report(event);
await client.postEvent(event);
```

## Options

| Option | Default | Description |
|---|---|---|
| `baseUrl` | `AI_OBSERVATORY_URL` | Observatory base URL |
| `apiKey` | `AI_OBSERVATORY_API_KEY` | Bearer API key |
| `environment` | `NODE_ENV` or `production` | Default for `buildEvent` / `reportEvent` |
| `fetch` | `globalThis.fetch` | Injectible for tests |
| `warn` | `console.warn` | Failure logger |

Full event schema: [docs/api.md](../../docs/api.md).
