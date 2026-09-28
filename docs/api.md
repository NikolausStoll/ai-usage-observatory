# AI Usage Observatory — API Reference

## Authentication

All ingestion and artifact endpoints require an application API key:

```
Authorization: Bearer <api-key>
```

Keys are created through the Observatory UI. A key identifies and authorizes exactly one registered application. The application identity is always derived server-side from the key — clients must not declare which application they represent.

---

## Endpoints

### POST /api/v1/events

Ingest a single AI usage event.

**Request**

```
POST /api/v1/events
Authorization: Bearer <api-key>
Content-Type: application/json
```

Body: event payload (see [Event Payload Reference](#event-payload-reference) below).

Maximum payload size: configurable via `MAX_EVENT_SIZE_BYTES` (default 1 MB).

**Responses**

| Status | Meaning |
|--------|---------|
| 200 | Event accepted (new or duplicate) |
| 400 | Validation error |
| 401 | Missing or invalid API key |
| 413 | Payload too large |

**Success (new event)**
```json
{
  "eventId": "0199c9f2-9f16-7abc-8def-123456789abc",
  "received": true,
  "duplicate": false
}
```

**Success (duplicate — already ingested)**
```json
{
  "eventId": "0199c9f2-9f16-7abc-8def-123456789abc",
  "received": false,
  "duplicate": true
}
```
A duplicate returns HTTP 200, not an error. The original event is unchanged.

**Validation error**
```json
{
  "error": "validation_error",
  "details": [
    { "path": ["eventId"], "message": "Invalid uuid" }
  ]
}
```

**Unauthorized**
```json
{ "error": "unauthorized" }
```

---

### POST /api/v1/events/{eventId}/artifacts

Upload an artifact associated with an existing event.

**Request**

```
POST /api/v1/events/{eventId}/artifacts
Authorization: Bearer <api-key>
Content-Type: multipart/form-data
```

Form fields:

| Field | Required | Description |
|-------|----------|-------------|
| `file` | yes | Binary file data |
| `role` | yes | `input` or `output` |
| `label` | no | Application-defined label (e.g. `recipe-page-1`) |

Maximum artifact size: configurable via `MAX_ARTIFACT_SIZE_BYTES` (default 25 MB).

**Responses**

| Status | Meaning |
|--------|---------|
| 200 | Artifact uploaded |
| 400 | Missing required fields |
| 401 | Missing or invalid API key |
| 403 | Event belongs to a different application |
| 404 | Event not found |
| 413 | Artifact exceeds size limit |

**Success**
```json
{
  "artifactId": "a1b2c3d4-...",
  "byteSize": 204800,
  "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

### GET /api/v1/artifacts/{artifactId}

Retrieve an artifact's binary content.

**Request**

```
GET /api/v1/artifacts/{artifactId}
Authorization: Bearer <api-key>
```

**Responses**

| Status | Meaning |
|--------|---------|
| 200 | Binary content with `Content-Type` header |
| 401 | Missing or invalid API key |
| 403 | Artifact belongs to a different application |
| 404 | Artifact not found |

---

## Event Payload Reference

All fields use camelCase. Timestamps are ISO 8601 UTC.

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | UUID string | Client-generated, globally unique, idempotency key |
| `timestamp` | ISO 8601 string | Start time of the AI provider attempt |
| `durationMs` | integer ≥ 0 | Client-observed duration of the attempt |
| `environment` | string | e.g. `production`, `staging`, `development`, `test` |
| `feature` | string | Stable app-defined feature name (e.g. `recipe-import`) |
| `operation` | string | Type of AI work (e.g. `image-extraction`) |
| `operationId` | string | Identifies one concrete logical execution |
| `attemptNumber` | integer ≥ 1 | Attempt number for this operation (usually `1`) |
| `status` | `"success"` or `"error"` | Whether the AI result was usable by the application |
| `provider` | string | AI provider name (e.g. `openai`, `anthropic`) |
| `requestedModel` | string | Model name as requested |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `workflowId` | string | Business-level correlation across operations |
| `applicationVersion` | string | App build/release version |
| `reportedModel` | string | Model name as reported by the provider |
| `promptId` | string | Application-defined prompt identifier |
| `promptVersion` | string | Application-defined prompt version |
| `httpStatus` | integer | HTTP status code from provider |
| `requestConfig` | object | Provider request configuration (temperature, etc.) |
| `request` | object | `{ input?, raw?, metadata? }` |
| `response` | object | `{ output?, raw?, metadata? }` |
| `usage` | object | Token usage (see below) |
| `error` | object | `{ type?, message?, metadata? }` |
| `metadata` | object | Application context (free-form JSON) |
| `metrics` | object | Application result metrics (free-form JSON) |

### Usage object

```json
{
  "inputTokens": 1200,
  "cachedInputTokens": 800,
  "outputTokens": 300,
  "reasoningTokens": 120,
  "totalTokens": 1500,
  "rawUsage": { "example": "provider-native representation" }
}
```

All token fields are nullable. `cachedInputTokens` is a subset of `inputTokens`.

---

## Complete Example

**Successful event:**

```json
{
  "eventId": "0199c9f2-9f16-7abc-8def-123456789abc",
  "timestamp": "2026-09-09T12:34:56.123Z",
  "durationMs": 1843,
  "environment": "production",
  "applicationVersion": "1.15.0",
  "feature": "recipe-import",
  "operation": "image-extraction",
  "operationId": "recipe-import:123:image-extraction",
  "workflowId": "recipe-import:123",
  "attemptNumber": 1,
  "status": "success",
  "provider": "openai",
  "requestedModel": "example-model",
  "reportedModel": "example-model-2026-09-01",
  "promptId": "recipe-image-extraction",
  "promptVersion": "14",
  "requestConfig": { "reasoningEffort": "medium" },
  "request": {
    "input": { "instruction": "Extract the recipe from the supplied image." },
    "raw": { "example": "provider request representation" },
    "metadata": { "imageCount": 1 }
  },
  "response": {
    "output": { "title": "Example Recipe" },
    "raw": { "example": "provider response representation" },
    "metadata": {}
  },
  "usage": {
    "inputTokens": 1200,
    "cachedInputTokens": 800,
    "outputTokens": 300,
    "reasoningTokens": 120,
    "totalTokens": 1500,
    "rawUsage": { "example": "provider-native usage representation" }
  },
  "metadata": { "importSource": "photo" },
  "metrics": { "confidence": 0.94, "ingredientCount": 12 }
}
```

**Error event (HTTP 200 from provider, unusable result):**

```json
{
  "eventId": "0199c9f2-9f16-7abc-8def-123456789abd",
  "timestamp": "2026-09-09T12:35:10.000Z",
  "durationMs": 2110,
  "environment": "production",
  "feature": "recipe-import",
  "operation": "image-extraction",
  "operationId": "recipe-import:124:image-extraction",
  "workflowId": "recipe-import:124",
  "attemptNumber": 1,
  "status": "error",
  "provider": "openai",
  "requestedModel": "example-model",
  "httpStatus": 200,
  "error": {
    "type": "schema_validation",
    "message": "AI response could not be used by the application",
    "metadata": { "validationErrors": 2 }
  },
  "response": { "output": { "unexpected": "shape" } },
  "usage": {
    "inputTokens": 900,
    "cachedInputTokens": null,
    "outputTokens": 210,
    "totalTokens": 1110,
    "rawUsage": {}
  }
}
```

---

## curl Examples

**Ingest an event:**
```bash
curl -X POST https://your-observatory.example.com/api/v1/events \
  -H "Authorization: Bearer obs_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"...","timestamp":"2026-09-09T12:00:00Z","durationMs":1000,...}'
```

**Upload an artifact:**
```bash
curl -X POST https://your-observatory.example.com/api/v1/events/EVENT_ID/artifacts \
  -H "Authorization: Bearer obs_your_api_key_here" \
  -F "role=input" \
  -F "label=recipe-image" \
  -F "file=@/path/to/image.jpg"
```

**Retrieve an artifact:**
```bash
curl https://your-observatory.example.com/api/v1/artifacts/ARTIFACT_ID \
  -H "Authorization: Bearer obs_your_api_key_here" \
  --output artifact.jpg
```

---

## Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Persistent data directory (artifacts; default DB parent) |
| `DB_PATH` | `<DATA_DIR>/observatory.sqlite` | SQLite database file path |
| `PORT` | `8096` | HTTP listen port |
| `NODE_ENV` | — | Set to `production` in container |
| `MAX_EVENT_SIZE_BYTES` | `1048576` | Maximum event payload size (1 MB) |
| `MAX_ARTIFACT_SIZE_BYTES` | `26214400` | Maximum artifact upload size (25 MB) |

Data layout inside `DATA_DIR`:
```
DATA_DIR/
  observatory.sqlite      — SQLite database (default; overridable via DB_PATH)
  artifacts/              — Artifact binary files
```
