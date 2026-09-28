# AI Usage Observatory --- Specification v0.2.2

## Home Assistant Add-on Packaging Addendum

**Status:** Implementation specification addendum\
**Version:** 0.2.2\
**Base specification:** AI Usage Observatory Specification v0.2.1\
**Scope:** Home Assistant Add-on packaging and deployment integration

------------------------------------------------------------------------

# 1. Purpose

Specification v0.2.1 defines the application, persistence, Docker
runtime, and Home Assistant-compatible operational behavior.

This addendum closes one remaining deployment gap:

> The AI Usage Observatory must not merely be a Docker application that
> could theoretically run on the Home Assistant host. The repository
> must be packaged as an actual installable Home Assistant Add-on
> Repository.

The existing v0.2.1 implementation is the baseline.

This addendum MUST be implemented incrementally. Do not rewrite the
application, change its architecture, or redesign already working
functionality.

Where this addendum conflicts with v0.2.1 regarding Home Assistant
packaging, this addendum takes precedence.

------------------------------------------------------------------------

# 2. Reference Implementation

The existing Media Library Home Assistant packaging supplied with this
specification work is the behavioral/reference model for repository
packaging.

Its Home Assistant add-on configuration demonstrates the intended
general approach:

-   repository metadata at repository root;
-   a dedicated add-on directory;
-   `config.yaml` describing the add-on;
-   a published GHCR image;
-   Home Assistant Ingress;
-   a directly exposed application port;
-   Home Assistant add-on options/schema where configuration is
    genuinely needed;
-   documentation and icon assets.

The Observatory MUST follow the same general Home Assistant packaging
model, adapted to Observatory requirements.

Do not copy Media Library-specific options or application configuration
that Observatory does not need.

------------------------------------------------------------------------

# 3. Repository Layout

The repository MUST be recognizable by Home Assistant as an Add-on
Repository.

Use this conceptual structure:

``` text
/
├── repository.yaml
├── ai-usage-observatory/
│   ├── config.yaml
│   ├── Dockerfile
│   ├── README.md
│   ├── DOCS.md
│   └── icon.png
├── package.json
├── src/
├── tests/
├── docs/
│   └── ...
└── ...
```

`repository.yaml` MUST exist directly at repository root. Each Home
Assistant add-on MUST exist as a direct child directory of repository
root. `ai-usage-observatory/config.yaml` MUST therefore be located at
`<repository-root>/ai-usage-observatory/config.yaml`. Additional
nesting such as `docker/ai-usage-observatory/config.yaml` is not
allowed.

Do not split the Observatory into multiple deployable services.

The application remains one full-stack TanStack Start application and
one Home Assistant add-on/container.

------------------------------------------------------------------------

# 4. Repository Metadata

A `repository.yaml` MUST exist at repository root.

It must contain valid Home Assistant Add-on Repository metadata,
including at least:

``` yaml
name: "AI Usage Observatory"
url: "<repository-url>"
maintainer: "<maintainer>"
```

Use the actual repository URL and maintainer information for the
project.

The repository metadata must be sufficient for Home Assistant to accept
the Git repository as an Add-on Repository.

------------------------------------------------------------------------

# 5. Add-on Definition

The add-on directory MUST contain a valid `config.yaml`.

It must define at least:

-   add-on name;
-   slug;
-   description;
-   version;
-   project URL;
-   supported architectures;
-   startup mode;
-   init behavior;
-   Ingress configuration;
-   directly exposed HTTP port;
-   image reference;
-   only genuinely useful Home Assistant options/schema.

The intended identity is conceptually:

``` yaml
name: "AI Usage Observatory"
slug: "ai-usage-observatory"
description: "Observability and cost analysis for AI usage"
```

Exact descriptive wording may be improved without changing meaning.

------------------------------------------------------------------------

# 6. Supported Architectures

The initial add-on SHOULD support the same practical Home Assistant
architecture range as the existing private add-ons where the application
dependencies permit it:

``` yaml
arch:
  - amd64
  - aarch64
  - armv7
```

Do not claim an architecture that cannot actually build and run because
of native dependencies such as `better-sqlite3`.

If one of these architectures is not technically supportable with the
selected dependency/build chain, report that explicitly rather than
publishing a broken architecture declaration.

The published container image/build pipeline must be consistent with the
architectures declared in `config.yaml`.

------------------------------------------------------------------------

# 7. Container Image

The Home Assistant add-on uses a published container image hosted on
GitHub Container Registry (GHCR), following the same general model as
the existing Media Library add-on.

Conceptually:

``` yaml
image: "ghcr.io/<owner>/ai-usage-observatory"
```

Use the actual repository owner/name.

The Home Assistant add-on version and published image version/tagging
strategy MUST be compatible so that Home Assistant installs the intended
release.

Do not introduce a second application image or separate frontend/backend
images.

------------------------------------------------------------------------

# 8. Ingress and Direct API Access

The Observatory has two distinct access patterns:

1.  interactive UI access;
2.  machine-to-machine event/artifact ingestion.

Both must work.

## 8.1 Home Assistant Ingress

Home Assistant Ingress MUST be enabled for the interactive Observatory
UI.

Conceptually:

``` yaml
ingress: true
ingress_port: <observatory-port>
```

The UI should therefore be usable from Home Assistant without requiring
the user to manually construct a direct URL.

The application itself MUST remain compatible with being served through
Home Assistant Ingress.

Do not introduce an Observatory login/session system.

Home Assistant/Cloudflare remains responsible for protecting interactive
access according to the deployment environment.

## 8.2 Direct port

The Observatory HTTP port MUST also be exposed directly.

This is required because external/private client applications need to
call:

``` text
POST /api/v1/events
POST /api/v1/events/{eventId}/artifacts
```

without going through the interactive Home Assistant Ingress flow.

Conceptually:

``` yaml
ports:
  <port>/tcp: <port>

ports_description:
  <port>/tcp: "AI Usage Observatory Web UI and ingestion API"
```

The exact port should follow the existing Observatory runtime
configuration and should not be changed without a concrete reason.

The direct API continues to use the existing application API-key
authentication.

Do not add Home Assistant authentication to the ingestion API.

------------------------------------------------------------------------

# 9. Persistent Storage

Home Assistant's persistent add-on data directory is the authoritative
persistent storage location.

The application MUST use:

``` text
/data/observatory.sqlite
/data/artifacts/
```

inside the add-on container.

This supersedes any need for users to configure database or artifact
paths through Home Assistant options.

Do not expose unnecessary options such as:

``` text
db_path
artifact_path
data_dir
```

unless the existing runtime genuinely requires them for a reason that
cannot be removed cleanly.

The application MUST continue to:

-   create required `/data` subdirectories automatically;
-   run migrations before accepting normal traffic;
-   persist SQLite data;
-   persist artifact binaries;
-   survive add-on/container restart and recreation using Home
    Assistant's persistent `/data`.

Home Assistant backups are responsible for backing up this persistent
data.

The Observatory MUST NOT implement its own backup system.

------------------------------------------------------------------------

# 10. Add-on Options

Keep Home Assistant configuration minimal.

Do not copy the Media Library option list.

Only expose an option when the user has a realistic reason to change it
through the Home Assistant Add-on configuration UI.

If the Observatory currently requires no user-configurable application
settings beyond values that can be fixed safely for the add-on, an
empty/minimal options/schema section is acceptable.

Configuration that is an internal implementation detail should not
become a Home Assistant option merely because it can be configurable.

Examples of values that SHOULD normally remain internal/fixed:

-   SQLite path;
-   artifact path;
-   migration path;
-   static asset path.

If the HTTP port is already defined by the add-on contract, avoid
duplicating unnecessary configuration unless required by the runtime.

------------------------------------------------------------------------

# 11. Local Development and Runtime Configuration

Local npm-based development is a first-class supported runtime mode. A
developer MUST be able to run the Observatory locally without Home
Assistant and without editing Home Assistant add-on files.

## 11.1 Single runtime configuration model

Application runtime configuration MUST have one canonical configuration
model. Environment variables are the application-level configuration
interface.

``` text
Local development
.env -> environment variables -> RuntimeConfig -> Observatory

Home Assistant
add-on packaging/defaults/options -> environment variables -> RuntimeConfig -> Observatory
```

Do NOT implement separate Home Assistant-specific and
local-development-specific application configuration logic. Home
Assistant packaging is a deployment adapter around the same runtime
configuration.

## 11.2 Local `.env`

Local development MUST support a repository-root `.env` file through the
normal npm development workflow.

Expected examples include:

``` env
PORT=3000
DATA_DIR=./data
EVENT_MAX_SIZE_BYTES=1048576
ARTIFACT_MAX_SIZE_MB=25
```

Preserve sensible existing environment-variable names where already
established.

`.env` MUST be gitignored. A committed `.env.example` MUST document
every supported application runtime environment variable with
safe/example values.

## 11.3 npm workflow

The intended local workflow is:

``` text
npm ci
cp .env.example .env
npm run dev
```

`npm run dev` MUST honor the environment configuration. The production
startup path MUST use the same runtime configuration semantics.

Tests SHOULD override configuration explicitly and MUST NOT depend on a
developer's personal `.env`.

## 11.4 Data directory

`DATA_DIR` is the canonical configurable application data root.

Local example/default:

``` text
./data
```

Home Assistant:

``` text
/data
```

Persistent paths are derived from it:

``` text
<DATA_DIR>/observatory.sqlite
<DATA_DIR>/artifacts/
```

Do not require separate DB/artifact path settings unless the existing
implementation genuinely requires them.

The Home Assistant `config.yaml` does NOT need to expose `DATA_DIR` as a
user-editable option. The add-on runtime may fix it to `/data`.

## 11.5 Ports and limits

Runtime values such as HTTP port and request/artifact size limits SHOULD
use the same environment-variable mechanism locally and in production.

Home Assistant may fix sensible values instead of exposing every
environment variable in its options UI. Environment configurability and
Home Assistant UI configurability are separate concerns.

## 11.6 Validation

Runtime configuration SHOULD be validated centrally at startup. Invalid
values should fail startup with a concise actionable error.

Do not build a generic configuration framework. A small typed/Zod-backed
runtime configuration module is sufficient.

## 11.7 Documentation

The repository README MUST document `.env.example`, the local npm
workflow, supported runtime environment variables, local data-directory
behavior, and the distinction between local configuration and Home
Assistant Add-on options.

Home Assistant MUST NOT be required for local development.

------------------------------------------------------------------------

# 12. Dockerfile for the Add-on

The add-on directory MUST contain the Dockerfile used for the Home
Assistant/GHCR deployment.

It should preserve the already verified v0.2.1 production behavior:

-   production TanStack Start build;
-   `better-sqlite3` native dependency support;
-   non-root application execution where practical;
-   correct `/data` initialization/permissions;
-   migrations before HTTP serving;
-   `/health`;
-   graceful SIGTERM/SIGINT handling;
-   stdout/stderr logging;
-   no runtime source build;
-   no `npm install` during container startup.

Do not create a fundamentally different runtime architecture just for
Home Assistant.

If the existing root Dockerfile already implements the correct runtime
behavior, reuse or relocate/adapt it rather than maintaining two
divergent Docker implementations.

There should be one authoritative production-container definition.

------------------------------------------------------------------------

# 13. Health and Startup

The existing health endpoint remains required:

``` text
GET /health
```

A healthy response indicates at minimum:

-   process is serving;
-   database is accessible;
-   required migrations have completed.

The add-on should use the existing Docker health behavior where
compatible with Home Assistant.

Startup remains:

``` text
container start
  -> prepare /data
  -> run migrations
  -> initialize database/runtime
  -> start HTTP server
  -> /health becomes ready
```

Do not add background orchestration infrastructure.

------------------------------------------------------------------------

# 14. Logging

All application and startup logs MUST continue to use stdout/stderr.

Do not create persistent application log files.

The logs must therefore naturally appear in the Home Assistant Add-on
log view.

Avoid noisy routine logging that makes the Home Assistant log difficult
to use.

------------------------------------------------------------------------

# 15. Documentation and Assets

The add-on directory MUST contain:

``` text
README.md
DOCS.md
icon.png
```

These should be sufficient for a user opening the add-on in Home
Assistant to understand:

-   what AI Usage Observatory does;
-   that it observes AI calls rather than routing them;
-   how to start the add-on;
-   how to open the UI;
-   how client applications reach the direct ingestion API;
-   that API keys are created in the Observatory UI;
-   where persistent data lives;
-   that Home Assistant backups include the add-on data;
-   any required configuration.

Documentation should remain concise and appropriate for a private
project.

Do not duplicate the full technical specification into the add-on
documentation.

------------------------------------------------------------------------

# 16. Authentication and Trust Boundary

No new authentication system is introduced.

## Interactive UI

Interactive access is protected by the surrounding Home
Assistant/Cloudflare deployment.

The Observatory itself does not implement user accounts or login
sessions.

## Ingestion API

The direct `/api/v1` ingestion API continues to authenticate using
Observatory application API keys.

The Home Assistant packaging MUST NOT bypass, replace, or weaken this
API-key authentication.

## Health

`/health` may remain unauthenticated.

It must not expose secrets or sensitive telemetry.

------------------------------------------------------------------------

# 17. Versioning

The add-on has an explicit version in `config.yaml`.

The implementation should define one simple release-versioning flow so
that:

-   the add-on version is clear;
-   the GHCR image corresponding to that version exists;
-   updating the version allows Home Assistant to recognize an update.

Do not build an elaborate release-management system.

The initial application/add-on version may start at an appropriate
pre-1.0 version such as:

``` text
0.1.0
```

if no product version has yet been established.

The specification version (`v0.2.2`) is independent from the
product/add-on release version.

------------------------------------------------------------------------

# 18. Build and Publication

The repository must contain enough configuration for the intended GHCR
image to be built reproducibly.

If a GitHub Actions image-publishing workflow already exists, adapt it
as necessary.

If none exists, add the minimal workflow needed to build and publish the
declared GHCR image for the supported architectures/releases.

Do not introduce a complex CI/CD system.

The build must use the same production Docker definition that is
expected to run as the Home Assistant add-on.

Native `better-sqlite3` requirements must be handled for every
architecture that is actually published.

------------------------------------------------------------------------

# 19. Home Assistant Acceptance Verification

This is a release verification requirement.

It does NOT require building a permanent automated Home Assistant test
environment.

Before considering v0.2.2 complete, verify on the actual Home Assistant
installation, or equivalently through the actual Home Assistant Add-on
installation flow where available:

1.  Add the Git repository as a Home Assistant Add-on Repository.
2.  Confirm that **AI Usage Observatory** appears in the Add-on Store.
3.  Install the add-on.
4.  Start the add-on.
5.  Confirm migrations/startup complete without manual container
    intervention.
6.  Confirm the add-on becomes healthy.
7.  Confirm logs are visible in the Home Assistant Add-on log.
8.  Open the Observatory UI through Home Assistant Ingress.
9.  Confirm the direct exposed port is reachable from a client that
    needs to call `/api/v1`.
10. Confirm an authenticated `/api/v1/events` request works through that
    direct port.
11. Upload at least one artifact through the normal API flow.
12. Restart/recreate/update the add-on.
13. Confirm the previously stored event remains available.
14. Confirm the previously stored artifact remains available.

These steps MAY be verified manually and reported.

Do not create a Home Assistant emulator, Supervisor test harness, or
permanent end-to-end orchestration framework solely to automate this
private V1 release check.

If a step cannot be executed from the development environment because it
requires the user's real Home Assistant instance, report it explicitly
as **requires manual Home Assistant verification** rather than claiming
it passed.

------------------------------------------------------------------------

# 20. Implementation Constraints

While implementing this addendum:

-   preserve the existing working Observatory application;
-   do not rewrite the TanStack Start application;
-   do not redesign the UI;
-   do not modify the external event contract;
-   do not modify pricing semantics;
-   do not introduce new persistence technologies;
-   do not add a second database;
-   do not add Docker Compose;
-   do not add a reverse proxy;
-   do not add an auth platform;
-   do not add a separate backend container;
-   do not add Kubernetes configuration;
-   do not add speculative Home Assistant abstractions.

This task is packaging and deployment integration, not a new product
phase.

------------------------------------------------------------------------

# 21. Completion Report

At completion report:

``` text
v0.2.2 Home Assistant Add-on packaging

Implemented:
- ...

Repository structure:
- repository.yaml: ...
- add-on directory: ...
- config.yaml: ...
- Dockerfile/image: ...
- documentation/assets: ...

Local configuration verification:
- `.env.example` present and documented: PASS/FAIL
- `npm run dev` honors local environment configuration: PASS/FAIL
- local `DATA_DIR` works without Home Assistant: PASS/FAIL

Build verification:
- npm run typecheck: PASS/FAIL
- npm run lint: PASS/FAIL
- npm test: PASS/FAIL
- npm run build: PASS/FAIL
- production Docker build: PASS/FAIL
- supported architecture builds: PASS/FAIL/NOT RUN

Home Assistant verification:
- repository accepted by HA: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- add-on visible: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- install: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- startup: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- Ingress UI: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- direct API port: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- authenticated ingestion: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- event persistence: PASS/FAIL/REQUIRES MANUAL VERIFICATION
- artifact persistence: PASS/FAIL/REQUIRES MANUAL VERIFICATION

Remaining deviations:
- None / ...
```

Do not claim Home Assistant-specific success for checks that were not
actually performed.

------------------------------------------------------------------------

# 22. Definition of Done

v0.2.2 is complete when the repository is no longer merely "Home
Assistant-compatible Docker software" but is packaged as a real Home
Assistant Add-on Repository.

The intended final user experience is:

``` text
Home Assistant
  -> Settings
  -> Add-ons
  -> Add-on Store
  -> Add repository
  -> AI Usage Observatory appears
  -> Install
  -> Start
  -> Open Web UI
```

and independently:

``` text
Private client application
  -> http://<home-assistant-host>:<observatory-port>/api/v1/events
  -> Observatory application API-key authentication
  -> event stored
```

with SQLite and artifacts persisted through Home Assistant's `/data`
lifecycle and included in the normal Home Assistant backup model.

Keep this implementation simple.
