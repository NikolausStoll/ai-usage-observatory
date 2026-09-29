# `@nikolausstoll/ai-observatory-client`

Fire-and-forget Node client for [AI Usage Observatory](https://github.com/NikolausStoll/ai-usage-observatory) event ingestion and artifact upload.

Missing `AI_OBSERVATORY_URL` / `AI_OBSERVATORY_API_KEY` (or explicit options) disables the client — calls become no-ops. Network and HTTP failures are logged and never thrown to the caller.

## Install

Prefer a release tarball (no registry auth):

```bash
npm install https://github.com/NikolausStoll/ai-usage-observatory/releases/download/client-v0.3.0/ai-observatory-client-0.3.0.tgz
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

const event = buildEvent({
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

await client.postEvent(event);

// After the event exists, attach binaries (images, files, …)
await client.uploadArtifact(event.eventId, {
  role: "input",
  data: imageBuffer,
  mimeType: "image/jpeg",
  filename: "page-1.jpg",
  label: "recipe-page-1",
});
```

Fire-and-forget variants:

```js
client.reportEvent({ /* ... */ });
client.reportArtifact(eventId, {
  role: "output",
  data: resultBuffer,
  mimeType: "application/json",
  filename: "result.json",
});
```

## Options

| Option | Default | Description |
|---|---|---|
| `baseUrl` | `AI_OBSERVATORY_URL` | Observatory base URL |
| `apiKey` | `AI_OBSERVATORY_API_KEY` | Bearer API key |
| `environment` | `NODE_ENV` or `production` | Default for `buildEvent` / `reportEvent` |
| `fetch` | `globalThis.fetch` | Injectible for tests |
| `warn` | `console.warn` | Failure logger |

## Artifacts

`uploadArtifact(eventId, input)` posts `multipart/form-data` to  
`POST /api/v1/events/{eventId}/artifacts`.

| Field | Required | Notes |
|---|---|---|
| `role` | yes | `input` or `output` |
| `data` | yes | `Buffer`, `Uint8Array`, `ArrayBuffer`, or `Blob` |
| `mimeType` | no | Defaults to `application/octet-stream` |
| `filename` | no | Multipart filename |
| `label` | no | App-defined label |

Returns `{ artifactId, byteSize, contentHash }` or `null` on failure / when disabled.

Upload artifacts **after** successful event ingestion — there is no shared transaction.

Full API: [docs/api.md](../../docs/api.md).
