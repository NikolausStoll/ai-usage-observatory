# AI Usage Observatory --- Specification v0.2.1

**Status:** Implementation specification\
**Version:** 0.2.1\
**Purpose:** Source of truth for the initial implementation\
**Target:** Private, self-hosted AI observability service

**Revision note:** v0.2.1 consolidates the original v0.2 decisions with the findings from the independent implementation comparison. It tightens repository boundaries, test organization, bounded request handling, decimal-safe aggregation, pricing transactionality, and Home Assistant/Docker runtime requirements without expanding the product scope.

------------------------------------------------------------------------

## 1. Execution Contract

This document is both the product/technical specification and the
binding execution plan for V1.

The implementation MUST be completed in the four phases defined in
Section 23.

### 1.1 Mandatory phase behavior

1.  Implement phases strictly in order.
2.  Do not implement features assigned to a later phase unless a minimal
    prerequisite is technically unavoidable.
3.  At the end of each phase:
    -   run the relevant build, type checks, linting, and automated
        tests;
    -   verify that the phase acceptance criteria are satisfied;
    -   provide the standardized completion report defined below;
    -   STOP and wait for the next phase instruction.
4.  Do not continue automatically into the next phase.
5.  Decisions explicitly made in this specification MUST NOT be replaced
    by preferred alternatives.
6.  Implementation details intentionally left open may be decided
    pragmatically.
7.  Prefer the simplest implementation satisfying the specification.
8.  If the specification contains a genuine contradiction or an
    implementation-blocking ambiguity, ask before changing the
    architecture.
9.  Do not introduce infrastructure or abstractions solely for
    hypothetical future scale.
10. The initial development task covers the Observatory only. Do not
    modify or implement integrations in Recipe App, Media Library, or
    other client applications, and do not create a reusable client SDK
    in V1.

### 1.2 Required phase completion report

At the end of every phase report:

``` text
Phase completed:

Implemented:
- ...

Tests and verification:
- ...

Commands executed:
- ...

Acceptance criteria:
- ...

Deviations from specification:
- None / ...

Open issues:
- None / ...

Architecture/files worth noting:
- ...
```

Any deviation MUST be explicitly reported.

------------------------------------------------------------------------

# 2. Vision

AI Usage Observatory is a central observability service for AI usage
across multiple private applications.

Applications continue to execute their own AI requests. The Observatory
does not execute, proxy, route, retry, or otherwise control those
requests.

The architecture is:

``` text
Application ──────> AI Provider
      │
      │ best-effort telemetry
      └───────────> AI Usage Observatory
```

The Observatory provides a central place to inspect:

-   applications using AI;
-   features and operations generating calls;
-   providers and models;
-   token consumption;
-   cached token usage;
-   reasoning token usage where available;
-   estimated costs;
-   latency;
-   prompt IDs and versions;
-   requests and responses;
-   errors;
-   attempts/retries;
-   application-specific metrics;
-   artifacts such as vision input images.

The long-term direction is an AI observability, analysis, debugging, and
experimentation platform.

V1 is intentionally much smaller than that long-term vision.

------------------------------------------------------------------------

# 3. Core Architecture Principles

## 3.1 Observe, do not control

The Observatory receives information about AI calls after they occur.

It is NOT:

-   an AI gateway;
-   an AI proxy;
-   a model router;
-   a prompt execution engine.

Provider-specific AI execution remains entirely within each application.

## 3.2 Zero runtime dependency

The Observatory is optional infrastructure.

Every client application must remain:

-   runnable without it;
-   testable without it;
-   deployable without it;
-   able to perform AI operations without it;
-   able to complete its normal workflow when Observatory reporting
    fails.

Telemetry failure MUST NOT turn into application failure.

## 3.3 Client owns provider knowledge

The application/client is responsible for:

-   provider calls;
-   prompts;
-   provider SDK/API behavior;
-   retry behavior;
-   provider-specific response interpretation;
-   normalization of provider usage into the generic Observatory event
    contract.

The Observatory MUST NOT parse provider-specific raw usage to derive
normalized usage.

In short:

> The client owns provider knowledge. The Observatory owns analysis
> knowledge.

## 3.4 Normalize for known analytics needs

Important universal dimensions are stored in normalized queryable
fields.

Provider- or application-specific information is retained in extensible
JSON.

Do not add dedicated schema fields merely because a provider happens to
expose a value.

## 3.5 Preserve raw information

Where available, raw request, response, usage, configuration, metadata,
and application metrics should be retained.

The system should prefer retaining useful debugging information over
premature data minimization for these private applications.

Binary content MUST NOT be embedded in usage events.

## 3.6 Keep V1 simple

The expected initial scale is only a few private applications and a
small number of providers/models.

Do not build complexity for hypothetical enterprise scale.

A future migration or redesign is acceptable if actual usage eventually
justifies it.

------------------------------------------------------------------------

# 4. Technology and Deployment Architecture

V1 is a single full-stack application.

## 4.1 Technology stack

Required:

-   TypeScript
-   React
-   TanStack Start
-   TanStack Router
-   TanStack Query where appropriate
-   TanStack Table where appropriate
-   Zod
-   SQLite
-   `better-sqlite3`
-   explicit SQL
-   filesystem artifact storage
-   Docker

Do NOT add:

-   Fastify;
-   Express;
-   Prisma;
-   Drizzle;
-   another ORM;
-   PostgreSQL;
-   Redis;
-   message queues;
-   background workers.

TanStack package versions should be pinned to concrete compatible
versions rather than broad version ranges, particularly while TanStack
Start remains pre-1.0.

## 4.2 TanStack Start responsibilities

TanStack Start is the full-stack framework.

External client applications communicate through normal Server Routes.

Example:

``` text
POST /api/v1/events
POST /api/v1/events/{eventId}/artifacts
```

Internal Observatory UI communication may use TanStack Server Functions.

Server Routes and Server Functions MUST remain thin transport layers.

Business logic, pricing logic, persistence logic, and analytics logic
MUST NOT be concentrated in route files.

## 4.3 Rendering

The application is SPA-first.

SSR is not a V1 requirement and should not be introduced without a
concrete need.

## 4.4 Database

V1 intentionally uses SQLite.

Use `better-sqlite3` and explicit SQL.

Do not introduce an ORM or an elaborate repository abstraction in
anticipation of a future database migration.

Schema changes are managed through versioned SQL migrations.

Migrations MUST execute automatically during container startup before
the application begins serving normal traffic.

## 4.5 Persistence layout

Use one configurable persistent data directory, conceptually:

``` text
/data/
  observatory.sqlite
  artifacts/
```

SQLite data and artifacts must therefore be coverable by one persistent
Home Assistant-backed volume.

## 4.6 Deployment

The intended deployment is:

-   one Docker container;
-   one persistent data volume;
-   stdout/stderr logging;
-   Home Assistant handles backups, including SQLite and artifacts;
-   Cloudflare protects interactive UI access using GitHub SSO.

The Observatory MUST NOT implement its own:

-   UI login;
-   user management;
-   sessions for authentication;
-   OAuth/OIDC login;
-   backup system.

The external ingestion API uses its own application API-key
authentication as defined later.


------------------------------------------------------------------------

## 4.7 Repository and code boundaries

The project is one TanStack Start application, but frontend and backend code MUST have a clear logical separation.

The exact TanStack Start route conventions may be used, but the implementation SHOULD follow a structure equivalent to:

```text
src/
  routes/                  # UI routes and thin API/server-function transport
  frontend/                # React UI components/features/hooks
  backend/                 # domain/application/persistence/server services
  shared/                  # genuinely shared types/schemas/constants only

tests/
  unit/
  integration/
  fixtures/

migrations/
```

Important rules:

- Frontend code MUST NOT import backend-only modules.
- Backend code MUST NOT depend on React/UI modules.
- API routes and Server Functions MUST remain thin transport adapters.
- Domain/application services, pricing, persistence, artifact storage, and authentication logic belong outside route components.
- Shared code MUST contain only code that is genuinely usable by both sides.
- Do not create a second frontend or backend application/package unless a concrete requirement appears later.

### Test organization

Automated tests MUST live outside `src/` in the repository's `tests/` tree.

Use a small, clear separation between:

- unit tests for domain/calculation logic;
- integration tests for database/API behavior;
- fixtures/test data.

A test file may be colocated with source code only if a framework constraint makes it genuinely necessary; this is an exception, not the default project organization.

------------------------------------------------------------------------

## 4.8 Home Assistant and container runtime contract

The intended production environment is a Home Assistant-hosted Docker/container deployment.

The application MUST be self-contained in one container and MUST NOT require another runtime service.

### Networking

- The application MUST listen on a configurable port.
- It MUST bind to `0.0.0.0`, not only localhost.
- The container exposes one application port.
- No additional ports are required for database, artifacts, metrics, or administration.

### Persistent data

All persistent application data MUST live below one configurable data directory, defaulting to `/data` in the container.

Conceptually:

```text
/data/
  observatory.sqlite
  observatory.sqlite-wal
  observatory.sqlite-shm
  artifacts/
```

SQLite temporary/WAL/SHM files MUST remain on the same persistent filesystem as the database.

The application MUST NOT write persistent state into the application/code directory or any other container path.

### Fresh-volume behavior

A fresh, empty persistent data directory MUST be a supported deployment state.

The application MUST be able to create the required subdirectories and database files on startup without requiring manual filesystem preparation inside the container.

The supported runtime UID/GID and filesystem-permission assumptions MUST be explicit in the Docker/deployment configuration.

A fresh host-mounted data directory MUST be covered by an automated or scripted deployment smoke test. The implementation MUST NOT rely only on Docker named-volume behavior if the intended Home Assistant deployment uses a host/bind-backed persistent directory.

### Startup and migrations

Container startup MUST perform database migrations before the application accepts normal traffic.

Startup sequence MUST be effectively:

```text
process starts
  -> validate/create data paths
  -> run migrations
  -> initialize required runtime state
  -> start HTTP server
  -> readiness becomes successful
```

A failed migration MUST prevent the application from reporting itself ready.

No request should be accepted against an incompletely migrated schema.

### Health

The application MUST provide a lightweight health endpoint, for example:

```text
GET /health
```

The endpoint MUST be suitable for a Docker `HEALTHCHECK`.

If a separate readiness concept is useful, it may be added, but no complex health framework is required.

### Shutdown

The process MUST handle normal container termination signals and close database/resources cleanly before exiting.

Do not spawn unrelated long-lived background processes.

### Logging

Application logs MUST go to stdout/stderr.

Do not require application log files inside the persistent data directory.

### Configuration

Deployment-specific configuration MUST come from environment variables or the container runtime configuration.

Do not hardcode host paths, hostnames, Cloudflare configuration, or Home Assistant-specific runtime identifiers into application code.

### Backup

Backups are outside the application's responsibility.

Home Assistant is responsible for backing up the persistent data directory, including both SQLite data and artifacts.

The application MUST therefore keep all state that must survive backup/restore within `/data`.

### External authentication boundary

The interactive UI is expected to be exposed behind Cloudflare with GitHub SSO.

The Observatory itself implements no interactive authentication.

This creates a deployment trust boundary: management/UI endpoints MUST NOT be intentionally exposed directly to an untrusted network without an equivalent external access control layer.

The application does not need to implement proxy-token validation or a second authentication system in V1.

------------------------------------------------------------------------

## 4.9 Production Docker build

The Docker image MUST be a reproducible production image suitable for Home Assistant deployment.

Use a multi-stage build where appropriate:

```text
builder
  -> install/build
  -> TanStack Start production build

runtime
  -> production dependencies only
  -> application startup/migrations
```

The final runtime image MUST NOT require:

- development server startup;
- `npm install` during container startup;
- compiler/build toolchains that are unnecessary at runtime;
- a separate database container.

Native dependencies such as `better-sqlite3` MUST be built or installed in a way compatible with the actual runtime image. The Docker build itself is a required acceptance criterion.

The implementation MUST pin direct dependency versions in the lockfile and MUST NOT use broad version ranges for TanStack dependencies where the specification calls for pinned versions.

------------------------------------------------------------------------

# 5. AI Event Model

## 5.1 Three correlation levels

The model has three levels:

``` text
Workflow
  └── Operation
        ├── Attempt/Event 1
        └── Attempt/Event 2
```

One Observatory event represents exactly one actual AI provider attempt.

### Event / attempt

A concrete provider request.

`eventId` identifies this attempt.

### Operation

A logical AI operation that may theoretically require multiple provider
attempts.

Examples:

-   image extraction;
-   normalization;
-   tagging.

All attempts of the same logical operation share an `operationId`.

### Workflow

An optional business-level correlation spanning multiple AI operations.

Example:

``` text
Recipe Import #123
  Image Extraction
  Normalization
  Tagging
  Nutrition Analysis
```

All may share:

``` text
workflowId = "recipe-import:123"
```

Workflow is only a correlation concept in V1.

There is no workflow entity, lifecycle, status, or workflow table
requirement.

## 5.2 IDs

### `eventId`

Required.

-   client-generated UUID;
-   globally unique;
-   identifies one provider attempt;
-   also serves as the sole idempotency key.

No separate `attemptId` exists.

### `operationId`

Required.

-   client-defined opaque string;
-   SHOULD be human-readable where useful;
-   stable across automatic retries of the same logical operation.

Example:

``` text
recipe-import:123:image-extraction
```

### `workflowId`

Optional.

-   client-defined opaque string;
-   SHOULD be human-readable where useful;
-   Observatory does not parse or interpret its structure.

Example:

``` text
recipe-import:123
```

## 5.3 Attempt number

`attemptNumber` is required and is a positive integer starting at `1`.

Current applications are expected to almost always send:

``` text
attemptNumber = 1
```

A manually triggered repeat is a new logical operation and therefore
receives a new `operationId`.

Do not add:

-   `isRetry`;
-   `previousAttemptId`;
-   retry reason graphs;
-   other retry infrastructure.

------------------------------------------------------------------------

# 6. Application Identity

Applications are registered entities in the Observatory.

Each application has at minimum:

-   stable technical application ID;
-   mutable display name;
-   creation metadata.

Example:

``` text
applicationId = "recipe-app"
displayName   = "Recipe App"
```

The application identity of an ingested event MUST be derived
server-side from the authenticated API key.

The client MUST NOT be trusted to declare which registered application
it represents.

## 6.1 API keys

One application may have multiple API keys.

Keys:

-   can be named;
-   belong to exactly one application;
-   can be individually revoked;
-   identify/authorize the reporting application;
-   have no scopes or roles in V1;
-   should store only a secure hash after creation;
-   show the plaintext secret only when initially created.

Useful metadata may include:

-   created timestamp;
-   last-used timestamp;
-   revoked timestamp.

Environment is NOT bound to an API key.

## 6.2 Application administration

Applications and API keys are managed through the Observatory UI.

No public management API is required for V1.

Applications with historical data are not hard-deleted in V1.

------------------------------------------------------------------------

# 7. Event Dimensions

## 7.1 Environment

Required, app-defined string.

Recommended conventional values:

``` text
production
staging
development
test
```

Other values are allowed.

There is no Environment entity in V1.

## 7.2 Application version

Optional, app-defined opaque string.

Examples:

``` text
1.14.2
2026.09.09
main-a8fc712
```

The Observatory does not impose version semantics.

Application version describes the executing application build/release
and is independent of prompt version.

## 7.3 Feature

Required stable app-defined string.

Example:

``` text
recipe-import
```

## 7.4 Operation

Required stable app-defined string describing the type of AI work.

Example:

``` text
image-extraction
```

`operation` is a stable analytics dimension.

`operationId` identifies one concrete logical execution.

The Observatory does not register, normalize, or interpret
feature/operation names.

Different strings are different dimensions.

------------------------------------------------------------------------

# 8. Provider and Model Information

Provider and model names are not registration-dependent.

Required:

-   `provider`
-   `requestedModel`

Optional:

-   `reportedModel`
-   model snapshot/version if separately available.

Unknown providers and unknown models MUST always be accepted if the rest
of the event is valid.

Examples:

``` text
provider       = "openai"
requestedModel = "gpt-x"
reportedModel  = "gpt-x-2026-09-01"
```

Raw names are preserved exactly as reported.

V1 has:

-   no model registry requirement;
-   no model alias engine;
-   no regex/pattern model mapping;
-   no automatic analytics mapping layer.

If later needed, such capabilities can be added without rewriting
historical event data.

------------------------------------------------------------------------

# 9. Prompt Tracking and Request Configuration

## 9.1 Prompt tracking

Optional:

-   `promptId`
-   `promptVersion`

Both are app-defined opaque strings.

Example:

``` text
promptId      = "recipe-image-extraction"
promptVersion = "14"
```

Application version and prompt version are independent analytics
dimensions.

V1 does NOT implement:

-   prompt hashing;
-   system prompt hashing;
-   user prompt hashing;
-   template hashing;
-   automatic prompt identity detection.

Actual request content can be retained through request storage.

## 9.2 Request configuration

Provider/model request configuration is stored as optional extensible
JSON.

Examples may include:

-   temperature;
-   reasoning effort;
-   max output tokens;
-   response format;
-   structured output settings;
-   image detail.

None of these are dedicated database columns in V1.

------------------------------------------------------------------------

# 10. Request and Response Storage

The Observatory supports rich request/response retention for debugging.

Conceptually:

``` text
request:
  input
  raw
  metadata

response:
  output
  raw
  metadata
```

`request.input` and `response.output` may be any JSON-compatible value,
including a plain string.

`raw` is optional and may contain provider-native JSON-compatible data.

`metadata` is optional extensible JSON.

The client does not need to redundantly populate normalized and raw
values when that provides no useful information.

Large binary content and base64-encoded artifacts MUST NOT be placed in
the event payload.

Event request size MUST have a configurable server limit. The exact
default may be chosen pragmatically during implementation, but it must
prevent accidental unbounded event payloads.

------------------------------------------------------------------------

# 11. Status and Errors

V1 has a deliberately small normalized status model:

``` text
success
error
```

Status describes whether the AI attempt produced a result usable by the
client application.

It does NOT merely describe whether the provider returned HTTP 2xx.

Example:

``` text
Provider HTTP response: 200
Tokens consumed: yes
Schema validation: failed
Event status: error
```

This is important because an unusable AI result can still incur cost.

Optional fields include:

-   HTTP status;
-   error type;
-   error message;
-   extensible error metadata.

Error type is app/provider-defined; V1 does not build a global error
taxonomy.

An error event may contain normal usage, request/response data,
artifacts, and cost.

------------------------------------------------------------------------

# 12. Timing

Client-required:

-   `timestamp`
-   `durationMs`

`timestamp` is the start time of the actual provider attempt.

`durationMs` is the total client-observed duration of that attempt.

The server adds:

-   `receivedAt`

`receivedAt` represents ingestion time at the Observatory.

All timestamps should use adequate precision and be stored consistently
in UTC.

The model can later approximate delivery delay using:

``` text
receivedAt - (timestamp + durationMs)
```

V1 does not normalize:

-   network duration;
-   provider-only duration;
-   queue duration;
-   time to first token;
-   streaming duration.

If no provider attempt occurred at all because local code rejected the
operation before making a provider request, no Observatory attempt event
is required.

------------------------------------------------------------------------

# 13. Token Usage

Normalized usage fields are nullable:

-   `inputTokens`
-   `cachedInputTokens`
-   `outputTokens`
-   `reasoningTokens`
-   `totalTokens`

The original provider usage structure may additionally be retained as:

-   `rawUsage`

Normalized fields represent client-normalized provider facts.

Unknown information remains `null`, not `0`.

The Observatory MUST NOT parse `rawUsage` to infer normalized provider
usage.

## 13.1 Cached token semantics

For V1 normalized semantics:

-   `inputTokens` = total input token count;
-   `cachedInputTokens` = cached subset of the input tokens.

Therefore:

``` text
uncachedInputTokens = inputTokens - cachedInputTokens
```

`uncachedInputTokens` is derived and is not separately persisted.

Where both normalized values are present, clearly inconsistent values
such as cached input greater than total input should be surfaced as a
data-quality warning. The implementation may reject impossible negative
token counts structurally.

------------------------------------------------------------------------

# 14. Custom Metadata and Metrics

Events may contain two separate optional extensible JSON concepts.

## 14.1 Metadata

Describes contextual information.

Example:

``` json
{
  "importSource": "photo",
  "recipeLanguage": "de"
}
```

## 14.2 Metrics

Contains application-specific result/quality metrics.

Example:

``` json
{
  "confidence": 0.91,
  "ingredientCount": 14,
  "missingFields": 2
}
```

V1 does NOT implement:

-   a metric registry;
-   dynamic metric schemas;
-   dedicated DB columns for arbitrary metrics;
-   a generic time-series metrics engine;
-   guaranteed aggregation of arbitrary custom metrics.

The functional UI should display these values on event detail where
useful.

Future versions may selectively promote important metrics into
analytics.

------------------------------------------------------------------------

# 15. Pricing

The Observatory centrally estimates cost from normalized usage and
versioned pricing.

Costs are analytics estimates, not billing-grade accounting.

## 15.1 V1 pricing dimensions

V1 supports only:

-   normal input;
-   cached input;
-   output.

Prices are stored per 1,000,000 tokens.

Reasoning tokens remain normalized usage but are not separately priced
in V1 unless the pricing model is deliberately extended in a future
version.

Do not build a generic pricing-rule engine.

## 15.2 Currency

V1 uses USD only.

Do not implement:

-   per-record currency selection;
-   currency conversion;
-   FX rates;
-   display-currency conversion.

## 15.3 Pricing records

A pricing record conceptually includes:

-   ID;
-   provider;
-   model;
-   input price per million tokens;
-   cached-input price per million tokens;
-   output price per million tokens;
-   `validFrom`;
-   `validUntil` nullable;
-   optional source/reference if useful;
-   created/updated timestamps.

## 15.4 Versioning

Pricing validity uses UTC timestamps with half-open interval semantics:

``` text
[validFrom, validUntil)
```

`validUntil = null` means no defined end.

For a given exact `provider + model`, pricing ranges MUST NOT overlap.

Gaps are allowed.

## 15.5 Model used for pricing

Pricing model selection is:

``` text
reportedModel ?? requestedModel
```

The model actually reported by the provider takes precedence.

## 15.6 Exact matching

V1 matches pricing using exact:

``` text
provider + pricingModel + event timestamp
```

There are no:

-   aliases;
-   prefix matches;
-   wildcard matches;
-   regex mappings.

The UI should make it easy to create missing pricing and copy an
existing pricing record as a starting point.

## 15.7 Missing pricing

Missing pricing is a normal state.

Events are accepted and retained even when no pricing exists.

The UI must make models/events with missing pricing visible.

When suitable pricing is later added, matching historical events are
recalculated.

## 15.8 Materialized costs

Persist the following derived cost components on each event:

-   `inputCost`
-   `cachedInputCost`
-   `outputCost`
-   `totalCost`
-   nullable `pricingId`

Do not add speculative `reasoningCost` or `otherCost` fields in V1.

These cost values are materialized derived data, not immutable
telemetry.

They may be recalculated whenever pricing changes.

## 15.9 Cost formula

For normalized usage:

``` text
cachedForPricing = cachedInputTokens ?? 0
inputForPricing  = inputTokens ?? 0
outputForPricing = outputTokens ?? 0

uncachedForPricing = max(inputForPricing - cachedForPricing, 0)

inputCost =
  uncachedForPricing * inputPricePerMillion / 1_000_000

cachedInputCost =
  cachedForPricing * cachedInputPricePerMillion / 1_000_000

outputCost =
  outputForPricing * outputPricePerMillion / 1_000_000

totalCost =
  inputCost + cachedInputCost + outputCost
```

Missing normalized token values remain `null` in persisted telemetry but
are treated as zero for cost estimation.

Example:

``` text
inputTokens       = 10,000
cachedInputTokens = null
```

The stored cached value remains `null`, but cost calculation treats
cached tokens as zero and therefore prices all 10,000 input tokens at
normal input price.

This deliberately favors a useful estimate over an unknown total.

An event with no usage may therefore have estimated cost zero when
matching pricing exists.

## 15.10 Precision

Cost calculation MUST NOT use floating-point arithmetic that introduces
meaningful accumulation errors.

In particular:

-   do not use SQLite `REAL` as the authoritative cost representation;
-   do not round individual event costs to cents;
-   do not use JavaScript `number` for authoritative decimal pricing
    calculations;
-   use decimal/fixed-precision arithmetic;
-   persist enough decimal precision to preserve sub-cent and very small
    per-request costs;
-   round only for UI presentation.

The implementation must ensure that, under identical pricing, summing
many materialized per-event costs produces the same result as pricing
the aggregated token quantities, except for no more than a deliberately
defined negligible representation boundary.

This invariant MUST be tested.

## 15.11 Pricing changes and recalculation

Pricing is administered through the UI only in V1.

Creating, correcting, or changing a pricing record synchronously
recalculates all affected historical events.

Pricing mutation + affected event recalculation MUST occur
transactionally.

Do not use:

-   job queues;
-   background workers;
-   asynchronous recalculation.

A genuine provider price change should normally create a new
time-versioned pricing record.

A correction of incorrectly entered historical pricing may modify the
existing record and recalculate affected events.

## 15.12 No persisted pricing status

Do not persist redundant states such as:

``` text
priced
missing
```

The UI derives pricing state from:

-   pricing reference;
-   normalized usage;
-   materialized costs.

Provider-reported cost, if present, remains in raw provider data only
and is not normalized in V1.

------------------------------------------------------------------------

# 16. Data Quality Hints

V1 should surface simple data-quality observations dynamically from
stored event data.

Do not create a warning table or generic data-quality engine.

Examples:

-   missing input tokens;
-   missing output tokens;
-   missing cached-input information where noteworthy;
-   cached input greater than total input;
-   missing pricing;
-   failed event with non-zero cost.

These hints are intended to help detect integration issues and should
not become a permanent workflow/state model.

------------------------------------------------------------------------

# 17. Artifacts

Actual artifact persistence is mandatory in V1 because artifacts are
essential for debugging vision and other multimodal calls.

## 17.1 Storage

Artifact binary data is stored on the local filesystem behind a small
storage abstraction.

Conceptually:

``` text
ArtifactStorage
  └── FileSystemArtifactStorage
```

The abstraction should allow future replacement with object storage, but
MUST NOT be overengineered.

Do not implement S3/object storage in V1.

## 17.2 Artifact relationship

An event has zero or more artifacts.

Artifact metadata should include at least:

-   artifact ID;
-   event ID;
-   role;
-   optional label;
-   MIME type;
-   optional original filename;
-   byte size;
-   optional width;
-   optional height;
-   content hash;
-   storage key/path;
-   creation timestamp.

The server should calculate technical metadata such as actual size and
content hash. For supported images it should determine dimensions where
practical.

## 17.3 Artifact role

The only normalized artifact role in V1 is:

``` text
input
output
```

`label` is optional and application-defined.

Examples:

``` text
role  = input
label = recipe-page-1
```

MIME type describes the file format.

Do not create a large artifact taxonomy.

## 17.4 Upload sequence

Event ingestion occurs first.

Artifacts are uploaded individually afterward and reference the existing
event.

Conceptually:

``` text
POST /api/v1/events
POST /api/v1/events/{eventId}/artifacts
POST /api/v1/events/{eventId}/artifacts
```

There is no transaction spanning event and artifacts.

Valid outcomes include:

``` text
Event      success
Artifact 1 success
Artifact 2 failure
Artifact 3 success
```

No rollback occurs.

If event ingestion fails, artifact upload should not be attempted by a
future client implementation.

V1 does not implement:

-   upload sessions;
-   pre-reserved artifact IDs;
-   temporary artifact workflows;
-   artifact rollback.

## 17.5 Limits

Any MIME type may be uploaded.

No MIME allowlist is required.

Default maximum artifact size:

``` text
25 MB per artifact
```

This limit must be configurable.

There is no V1 quota for number of artifacts per event.

An artifact exceeding the limit fails independently; the event remains
intact.

## 17.6 UI

Event detail must make artifacts actually useful.

For image artifacts, display the image rather than only file metadata.

Other artifacts should at minimum expose useful metadata and an
appropriate way to inspect/download them where practical.

------------------------------------------------------------------------

# 18. Best-Effort Client Contract

Although V1 does not implement a reusable client SDK or modify any
existing applications, the external API is designed around the following
required client behavior.

## 18.1 Optional configuration

A future client should be able to disable reporting completely when no
Observatory URL is configured.

Conceptually:

``` text
AI_OBSERVATORY_URL
```

No Observatory must be required for client tests or runtime.

## 18.2 Reporting behavior

Reporting is synchronous best-effort after the AI attempt.

Reference behavior:

1.  AI attempt completes.
2.  Client attempts event POST.
3.  Client waits only for the configured short Observatory timeout.
4.  Reporting failure is logged locally and discarded.
5.  Business workflow continues regardless.
6.  Only after successful event ingestion are optional artifacts
    attempted.

No automatic retry occurs.

## 18.3 Timeouts

Default future-client timeouts are:

``` text
event ingestion:      1 second
artifact upload:      5 seconds per artifact
```

Both should be client-configurable.

## 18.4 Delivery guarantees

V1 explicitly provides no delivery guarantee.

Event loss is acceptable.

Do not introduce:

-   persistent client buffering;
-   filesystem fallback;
-   retry queues;
-   background delivery;
-   batch delivery;
-   failure-handler frameworks.

These may be considered later if real usage demonstrates a need.

------------------------------------------------------------------------

# 19. External API

The external client-facing API is versioned from the beginning.

Use:

``` text
/api/v1/...
```

Internal UI Server Functions are not part of this versioned public
contract.

## 19.1 Event ingestion

Provide a single-event ingestion endpoint.

Conceptually:

``` text
POST /api/v1/events
```

V1 does not support batch ingestion.

The endpoint:

-   authenticates via application API key;
-   derives application identity from the key;
-   validates the event contract;
-   enforces event idempotency;
-   stores immutable telemetry;
-   resolves matching pricing if possible;
-   calculates/materializes cost if possible;
-   returns a concise success response.

Exact HTTP response shapes may be chosen pragmatically but must be
documented.

## 19.2 Artifact upload

Provide an artifact upload endpoint associated with an existing event.

Conceptually:

``` text
POST /api/v1/events/{eventId}/artifacts
```

Multipart upload is appropriate.

The exact contract must support:

-   role;
-   optional label;
-   file.

## 19.3 API validation

Use Zod for runtime validation and derive TypeScript types from the same
schemas where practical.

The contract is structurally strict.

Reject examples such as:

-   missing event ID;
-   invalid UUID where UUID is required;
-   invalid timestamp;
-   negative duration;
-   attempt number below 1;
-   unknown status;
-   negative normalized token counts.

Extensible JSON areas remain deliberately tolerant:

-   metadata;
-   metrics;
-   request raw/metadata;
-   response raw/metadata;
-   request configuration;
-   raw usage;
-   error metadata.

Invalid events must fail atomically with an appropriate 4xx response and
MUST NOT be partially persisted.

------------------------------------------------------------------------

# 20. Idempotency and Immutability

`eventId` is the sole idempotency key.

The database must enforce uniqueness.

If the same `eventId` is submitted again:

-   do not create a duplicate;
-   do not count cost twice;
-   do not overwrite the original telemetry.

A second payload with the same event ID but different content MUST NOT
mutate the stored event.

Successfully ingested telemetry is immutable.

This includes:

-   identity/dimensions;
-   timestamps;
-   request/response;
-   normalized usage;
-   raw usage;
-   status/error data;
-   metadata/metrics.

Pricing and materialized cost are explicitly excluded from telemetry
immutability because cost is derived and recalculable.

V1 exposes no UI/API for editing or deleting ingested events or
artifacts.

------------------------------------------------------------------------

# 21. Functional V1 UI

V1 UI is intentionally functional rather than polished.

Do not spend significant effort designing the final analytics experience
before real data exists.

The purpose of the initial UI is to validate the backend, inspect actual
usage, and learn how the Observatory will be used.

## 21.1 Required functional areas

### Events

Provide:

-   event list;
-   useful basic filtering;
-   navigation to event detail;
-   visibility of status, application, environment, feature, operation,
    provider/model, tokens, estimated cost, and timestamp where
    practical.

Filters represented in URL state should use TanStack Router typed search
parameters where appropriate.

Do not overdesign filtering.

### Event detail

Expose enough information to debug an AI attempt:

-   application;
-   application version;
-   environment;
-   feature;
-   operation;
-   operation ID;
-   workflow ID;
-   attempt number;
-   timestamp;
-   duration;
-   received time;
-   status/error;
-   provider;
-   requested model;
-   reported model;
-   prompt ID/version;
-   normalized token usage;
-   raw usage;
-   materialized cost breakdown;
-   pricing reference/state;
-   request;
-   response;
-   request configuration;
-   metadata;
-   custom metrics;
-   artifacts;
-   dynamically derived data-quality hints.

JSON should be presented readably.

Images must be viewable.

### Applications

Provide simple UI to:

-   list applications;
-   create application;
-   change display name where useful;
-   view API keys;
-   create named API key;
-   show plaintext key once on creation;
-   revoke a key.

No complex lifecycle UI.

### Pricing

Provide simple UI to:

-   list pricing;
-   create pricing;
-   edit/correct pricing;
-   define validity;
-   prevent overlapping pricing ranges;
-   identify provider/model combinations observed in events that
    currently lack pricing;
-   conveniently create missing pricing;
-   copy an existing pricing record as a starting point.

Pricing changes synchronously recalculate affected events.

### Basic usage visibility

Provide enough basic totals/summary information to verify that:

-   events are arriving;
-   token totals make sense;
-   costs are being calculated;
-   missing pricing is visible.

## 21.2 Explicitly deferred UI work

Do NOT treat the following as V1 requirements:

-   polished analytics dashboard;
-   elaborate KPI card system;
-   sophisticated chart suite;
-   dedicated application dashboard;
-   dedicated model dashboard;
-   dedicated feature dashboard;
-   experiment UI;
-   model comparison UI;
-   prompt comparison UI;
-   workflow visualization;
-   anomaly detection;
-   cost forecasting.

These should be designed after real Observatory usage is available.

------------------------------------------------------------------------

# 22. Data Retention

V1 automatically deletes nothing.

Retain indefinitely:

-   events;
-   request/response data;
-   usage;
-   metadata/metrics;
-   artifacts.

Do not implement:

-   retention policies;
-   archival;
-   cleanup jobs;
-   automatic artifact deletion.

If storage eventually becomes a real problem, retention will be designed
based on actual usage.

------------------------------------------------------------------------

# 22.1 Post-implementation correction pass

This v0.2.1 specification is also intended to correct the already-created implementations before further feature work continues.

If an implementation already contains all four original phases, do NOT rebuild the product from scratch.

Instead:

1. Compare the existing implementation against v0.2.1.
2. Preserve compliant functionality.
3. Correct only deviations and the newly specified repository/runtime requirements.
4. Add or improve acceptance tests where required.
5. Re-run the complete verification suite.
6. Do not introduce unrelated product features.

This correction pass is complete only when the implementation satisfies v0.2.1 and the Phase 4 acceptance gate can be demonstrated again.

# 23. Implementation Phases

The implementation MUST follow these phases exactly.

------------------------------------------------------------------------

## Phase 1 --- Foundation, Persistence, Application Identity, and Event Ingestion

### Scope

Establish the runnable application and core telemetry pipeline.

Implement:

-   TanStack Start project foundation;
-   SPA-first setup;
-   project structure separating transport/business/persistence
    concerns;
-   SQLite with `better-sqlite3`;
-   versioned SQL migration mechanism;
-   automatic migrations;
-   core event schema;
-   Zod validation;
-   applications persistence;
-   API-key persistence/security;
-   minimal mechanism to seed/create an application/key for tests before
    the administration UI exists;
-   API-key authentication middleware/helper;
-   `/api/v1/events`;
-   immutable event persistence;
-   event ID idempotency;
-   normalized usage fields;
-   raw/extensible JSON storage;
-   request/response storage;
-   status/errors;
-   timestamps/duration;
-   prompt/version;
-   metadata/metrics;
-   provider/model fields;
-   operation/workflow correlation;
-   tests for Phase 1 behavior in the repository `tests/` tree.

Pricing and artifacts are NOT implemented in Phase 1.

The event schema should already leave the required nullable derived-cost
fields/schema relationship ready only if necessary for migrations, but
cost behavior belongs to Phase 2.

### Phase 1 acceptance gate

Must demonstrate:

-   application starts;
-   migrations execute;
-   valid authenticated event can be ingested;
-   application identity comes from API key;
-   revoked/invalid key is rejected;
-   malformed event is rejected atomically;
-   duplicate `eventId` does not create or overwrite telemetry;
-   error events can contain usage/response information;
-   extensible JSON survives round-trip persistence;
-   tests pass;
-   production build succeeds.

Then report and STOP.

------------------------------------------------------------------------

## Phase 2 --- Pricing, Cost Calculation, and Artifacts

### Scope

Implement the core observability features that enrich telemetry.

Implement:

-   pricing persistence;
-   exact provider/model/time matching;
-   `reportedModel ?? requestedModel`;
-   non-overlapping pricing validation;
-   USD pricing per million tokens;
-   high-precision decimal calculation/storage;
-   materialized input/cached/output/total cost;
-   missing usage treated as zero only for pricing calculations;
-   historical pricing application;
-   synchronous transactional recalculation;
-   artifact metadata persistence;
-   `ArtifactStorage` abstraction;
-   filesystem implementation;
-   artifact upload endpoint;
-   input/output artifact roles;
-   optional label;
-   size/hash calculation;
-   image dimensions where practical;
-   configurable 25 MB default artifact limit;
-   serving/accessing artifacts for later UI use;
-   tests for Phase 2 behavior.

Do not implement the full administration/event UI yet.

### Phase 2 acceptance gate

Must demonstrate:

-   event with matching pricing receives materialized cost;
-   reported model takes precedence;
-   missing pricing does not reject event;
-   adding historical pricing can price existing events;
-   correcting pricing recalculates affected events;
-   overlapping pricing is prevented;
-   cached-input pricing formula is correct;
-   missing token fields remain `null` while pricing treats them as
    zero;
-   high-precision accumulation invariant passes;
-   artifact can be uploaded and associated with event;
-   oversized artifact fails without affecting event;
-   artifact binary is outside SQLite event rows;
-   tests pass;
-   production build succeeds.

Then report and STOP.

------------------------------------------------------------------------

## Phase 3 --- Functional UI and Administration

### Scope

Build only the functional UI required to operate and inspect the system.

Implement:

-   basic navigation;
-   event list;
-   useful basic event filters;
-   URL-backed filters where appropriate;
-   event detail;
-   readable JSON/raw data presentation;
-   token/cost breakdown;
-   status/error presentation;
-   data-quality hints;
-   artifact display, especially images;
-   application administration;
-   API-key creation/revocation;
-   pricing administration;
-   missing-pricing discovery;
-   pricing copy/convenience flow;
-   basic usage/cost totals sufficient to verify system behavior.

Do not turn this phase into a dashboard redesign project.

### Phase 3 acceptance gate

Must demonstrate through the UI:

-   applications and keys can be managed;
-   pricing can be managed;
-   missing pricing is discoverable;
-   pricing updates visibly affect historical event costs;
-   events can be filtered and inspected;
-   request/response/raw data is readable;
-   errors with costs are understandable;
-   images are viewable alongside event details;
-   incomplete usage/missing pricing hints are visible;
-   tests appropriate to important UI behavior pass;
-   production build succeeds.

Then report and STOP.

------------------------------------------------------------------------

## Phase 4 --- Hardening, Acceptance Verification, and Home Assistant Deployment

### Scope

Complete and verify the V1 implementation without expanding product
scope.

Implement/finalize:

-   Docker image;
-   single-container runtime;
-   configurable persistent data directory;
-   SQLite/artifact layout;
-   startup migrations;
-   stdout/stderr logging;
-   environment configuration;
-   final API documentation;
-   representative fixture/example requests;
-   complete critical acceptance test suite;
-   cleanup/refactoring only where justified;
-   final specification compliance review.

Do not add new product features simply because they seem useful.

### Phase 4 acceptance gate

All critical acceptance criteria in Section 24 must pass.

Container must:

-   build successfully from the repository Dockerfile;
-   start from a clean host-mounted persistent data directory;
-   automatically create required directories and migrate DB before readiness;
-   expose the application on `0.0.0.0`;
-   pass `/health`;
-   persist data across restart;
-   store SQLite and artifacts entirely under the persistent data directory;
-   log through stdout/stderr;
-   handle normal container termination;
-   require no database/container dependency other than itself;
-   use a runtime UID/GID/filesystem arrangement that works with the intended Home Assistant volume model;
-   be suitable for Home Assistant-managed persistent storage and backup.

Then provide the final report.

------------------------------------------------------------------------

# 24. Critical Acceptance Criteria

These requirements are mandatory and should be automated where
practical.

## 24.1 Ingestion and validation

Test:

-   valid event ingestion;
-   required-field validation;
-   invalid enum/status;
-   invalid timestamps;
-   negative tokens;
-   negative duration;
-   invalid attempt number;
-   atomic rejection;
-   extensible JSON preservation.

## 24.2 Authentication

Test:

-   valid application key;
-   invalid key;
-   revoked key;
-   server-side application identity;
-   multiple keys for one application.

## 24.3 Idempotency and immutability

Test:

-   duplicate event ID creates one event only;
-   duplicate does not double cost;
-   duplicate with changed payload does not overwrite telemetry.

## 24.4 Status/error behavior

Test:

-   successful attempt;
-   error without usage;
-   error with usage;
-   error with HTTP 200 and unusable application result representation.

## 24.5 Pricing resolution

Test:

-   requested model used when reported model absent;
-   reported model takes precedence;
-   exact provider/model matching;
-   timestamp validity boundaries;
-   gaps produce missing pricing;
-   overlaps are prevented.

## 24.6 Cost calculation

Test:

-   normal input;
-   cached input;
-   output;
-   correct uncached-input derivation;
-   null cached tokens treated as zero for pricing but remain null in
    telemetry;
-   null input/output treated as zero for pricing but remain null;
-   error event can have non-zero cost;
-   event with no usage can estimate zero cost.

## 24.7 Pricing recalculation

Test:

-   adding pricing after events exist;
-   changing/correcting pricing;
-   only relevant events are recalculated;
-   recalculation is transactional.

## 24.8 Decimal precision

Create a large number of low-token synthetic events under identical
pricing.

Verify that:

``` text
SUM(materialized event costs)
```

matches the equivalent calculation from aggregated token quantities
without meaningful rounding drift.

No per-event cent rounding is allowed.

Dashboard/summary aggregation must also preserve decimal correctness and must not cast authoritative cost values to floating point.

## 24.9 Artifacts

Test:

-   upload;
-   association with event;
-   metadata;
-   hash/size;
-   image dimensions where supported;
-   input/output role;
-   optional label;
-   oversized upload rejection;
-   event survives artifact failure;
-   artifact binary is stored outside the event/database payload.

## 24.10 Persistence

Test or verify:

-   migrations from clean database;
-   restart persistence;
-   artifact persistence;
-   automatic startup migration behavior.

## 24.11 Repository and runtime structure

Verify:

- frontend/backend boundaries are clear;
- backend-only imports cannot leak into frontend bundles;
- automated tests live outside `src/`;
- production Docker image builds;
- fresh bind-mounted `/data` starts successfully;
- `/health` works after successful migrations;
- container restart preserves DB and artifacts.

## 24.12 Build quality

At the end of every phase:

-   type checking succeeds;
-   relevant linting succeeds;
-   automated tests succeed;
-   production build succeeds.

No arbitrary code-coverage percentage is required.

Prioritize meaningful tests of business/data invariants over coverage
gaming.

------------------------------------------------------------------------

# 25. Explicit Non-Goals / Do Not Overengineer

V1 MUST NOT become:

-   AI gateway;
-   AI proxy;
-   AI model router;
-   centralized prompt execution service;
-   client SDK project;
-   mandatory dependency for client applications;
-   job queue;
-   background worker system;
-   batch ingestion system;
-   persistent telemetry delivery system;
-   retry system;
-   distributed tracing platform;
-   general metrics/time-series platform;
-   full experimentation platform;
-   feature flag system;
-   enterprise identity system;
-   provider abstraction layer for AI execution;
-   automatic provider usage parser;
-   model registry;
-   model alias/mapping engine;
-   generic pricing-rule engine;
-   currency/FX system;
-   automated pricing scraper;
-   retention system;
-   object-storage integration;
-   polished final analytics dashboard.

Do not add infrastructure because it might be useful at hypothetical
future scale.

------------------------------------------------------------------------

# 26. Future Directions --- Not V1 Requirements

The data model and architecture should avoid unnecessarily blocking
later additions such as:

-   batch ingestion;
-   local buffering;
-   asynchronous delivery;
-   automatic pricing updates;
-   additional pricing dimensions;
-   multiple currencies if genuinely needed;
-   model aliases/analytics grouping;
-   artifact retention;
-   object storage;
-   human ratings;
-   evaluation scores;
-   experiment IDs/groups;
-   prompt comparisons;
-   model comparisons;
-   custom metric analytics;
-   anomaly detection;
-   cost alerts;
-   budgets;
-   forecasts;
-   cached-token optimization analysis;
-   workflow-level analytics;
-   more sophisticated dashboards;
-   eventual AI gateway/routing only if explicitly desired later.

These possibilities are context, not implementation requirements.

------------------------------------------------------------------------

# 27. Representative Event Contract

The exact TypeScript/Zod schema is an implementation artifact, but it
MUST express the semantics defined above.

A representative request is:

``` json
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
  "requestConfig": {
    "reasoningEffort": "medium"
  },
  "request": {
    "input": {
      "instruction": "Extract the recipe from the supplied image."
    },
    "raw": {
      "example": "provider request representation"
    },
    "metadata": {
      "imageCount": 1
    }
  },
  "response": {
    "output": {
      "title": "Example Recipe"
    },
    "raw": {
      "example": "provider response representation"
    },
    "metadata": {}
  },
  "usage": {
    "inputTokens": 1200,
    "cachedInputTokens": 800,
    "outputTokens": 300,
    "reasoningTokens": 120,
    "totalTokens": 1500,
    "rawUsage": {
      "example": "provider-native usage representation"
    }
  },
  "metadata": {
    "importSource": "photo"
  },
  "metrics": {
    "confidence": 0.94,
    "ingredientCount": 12
  }
}
```

An error example may legitimately contain usage and cost-relevant
information:

``` json
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
    "metadata": {
      "validationErrors": 2
    }
  },
  "response": {
    "output": {
      "unexpected": "shape"
    }
  },
  "usage": {
    "inputTokens": 900,
    "cachedInputTokens": null,
    "outputTokens": 210,
    "reasoningTokens": null,
    "totalTokens": 1110,
    "rawUsage": {}
  }
}
```

The registered application is intentionally absent from both payloads
because it is derived from the API key.

------------------------------------------------------------------------

# 28. Guiding Summary

When implementation choices are unclear, prefer the option that best
preserves these rules:

1.  **Observe, do not control.**
2.  **Never break the originating application.**
3.  **The client owns provider-specific AI behavior.**
4.  **The Observatory receives provider-neutral telemetry.**
5.  **Store normalized fields for actual analytics needs.**
6.  **Preserve raw/extensible information for debugging.**
7.  **An event is one actual provider attempt.**
8.  **Workflow is correlation, not orchestration.**
9.  **Historical cost is derived from immutable usage + versioned
    pricing.**
10. **Cost estimates favor usefulness over billing-grade perfection.**
11. **Never round tiny per-event costs prematurely.**
12. **Artifacts are first-class debugging data.**
13. **Telemetry and artifact delivery are best-effort.**
14. **SQLite and filesystem storage are intentional V1 simplicity.**
15. **Do not solve scale or complexity that does not exist yet.**
16. **Build the backend/data pipeline first; learn from real usage
    before designing the final analytics UI.**
17. **Follow the four implementation phases and stop after each phase. When working from an already completed implementation, use the post-implementation correction pass in §22.1 instead of rebuilding compliant functionality.**
