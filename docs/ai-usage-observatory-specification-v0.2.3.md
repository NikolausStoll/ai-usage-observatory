# AI Usage Observatory --- Specification v0.2.3

## JSON Pricing Import Addendum

**Status:** Implementation specification addendum\
**Version:** 0.2.3\
**Base specification:** AI Usage Observatory Specification v0.2.2\
**Scope:** JSON-based bulk pricing import

---

# 1. Purpose

This addendum adds a JSON file import capability to the Pricing administration UI.

It enables operators to import one or more pricing records from a structured JSON file
rather than entering them individually through the form.

The implementation reuses all existing pricing domain logic: overlap validation,
decimal-safe arithmetic, transactional recalculation, and the `source` field.

---

# 2. Import File Format

The import file uses a versioned JSON format with `schemaVersion: 1`.

```json
{
  "schemaVersion": 1,
  "provider": "openai",
  "source": "optional source/reference URL",
  "prices": [
    {
      "model": "gpt-5.6-luna",
      "validFrom": "2026-09-01T00:00:00Z",
      "validUntil": "2027-01-01T00:00:00Z",
      "inputPerMillion": "1.250000000000",
      "cachedInputPerMillion": "0.125000000000",
      "outputPerMillion": "10.000000000000"
    }
  ]
}
```

## 2.1 Field definitions

| Field | Required | Description |
|---|---|---|
| `schemaVersion` | yes | Must be `1`. Any other value is rejected. |
| `provider` | yes | Provider string (e.g. `"openai"`). |
| `source` | no | Optional reference URL or label stored with imported records. |
| `prices` | yes | Array of one or more pricing entries. |
| `prices[].model` | yes | Model string, exact match semantics. |
| `prices[].validFrom` | yes | ISO 8601 UTC start of validity interval (inclusive). |
| `prices[].validUntil` | no | ISO 8601 UTC end of validity interval (exclusive). Omit for open-ended. |
| `prices[].inputPerMillion` | yes | Normal input price per 1M tokens, **decimal string** (e.g. `"1.250000000000"`). |
| `prices[].cachedInputPerMillion` | yes | Cached input price per 1M tokens, **decimal string**. |
| `prices[].outputPerMillion` | yes | Output price per 1M tokens, **decimal string**. |

## 2.2 Decimal string requirement

All price fields MUST be decimal strings with a fractional part (matching `/^\d+\.\d+$/`).

JavaScript floating-point values (e.g. `1.25` as a JSON number) are NOT allowed.

This preserves decimal precision through the full import pipeline.

---

# 3. Import Pipeline

The import follows a two-step preview-then-confirm flow:

```
Select JSON file
  -> parse + validate with Zod
  -> classify each entry against existing pricing
  -> show preview with status per entry
  -> user confirms (or cancels)
  -> transactional import via existing pricing service
```

Nothing is persisted until the user explicitly confirms.

## 3.1 Preview classification

Each entry in the import file is classified as one of:

| Status | Meaning |
|---|---|
| **new** | No existing record for this provider/model overlaps this validity range. Will be created on confirm. |
| **unchanged** | An exact match already exists (same provider, model, validFrom, validUntil, and all three prices). Will be skipped on confirm. |
| **conflict** | An existing record for this provider/model has an overlapping (but non-identical) validity range. Import is blocked until conflict is resolved. |

## 3.2 Conflict handling

If any entry has status `conflict`, the confirm button is disabled.

The operator must resolve conflicts by editing or removing the conflicting existing records before re-importing.

## 3.3 Transactional import

On confirmation, all `new` entries are created in a single SQLite transaction.

If any single entry fails (e.g. due to a race condition creating a conflict after preview),
the entire import rolls back.

Existing overlap validation, recalculation, and `source` persistence are reused unchanged.

---

# 4. Implementation

## 4.1 New files

| File | Purpose |
|---|---|
| `src/domain/pricing/import-schema.ts` | Zod schema for the import file format; `parseImportFile()` (client-safe) |
| `src/domain/pricing/import-service.ts` | `previewImport()`, `executeImport()` (server-only, DB-dependent) |

## 4.2 Modified files

| File | Change |
|---|---|
| `src/server-functions/pricing.ts` | Added `previewPricingImport` and `executePricingImport` server functions |
| `src/routes/pricing/index.tsx` | Added "Import from JSON" section with file picker, preview table, and confirm flow |

## 4.3 No migration required

The `source TEXT` column already exists in the `pricing` table (added in `002_pricing_artifacts.sql`).
No new migration is needed.

## 4.4 Client/server boundary

`parseImportFile` lives in `import-schema.ts` (Zod only, no Node.js imports) and is safe to call
in the browser during file selection.

`previewImport` and `executeImport` live in `import-service.ts` (DB-dependent) and are only
called through server functions.

---

# 5. Future extensibility

The import format and pipeline are designed so a future "Fetch OpenAI Pricing" feature
can produce a `PricingImportFile` object programmatically and pass it directly into the same
`previewImport` / `executeImport` pipeline without any format changes.

---

# 6. Explicitly not included

- YAML support
- Provider-specific pricing scrapers
- Automatic web fetching or scheduled updates
- Provider-specific pricing logic
- A generic import framework

---

# 7. Acceptance criteria

- `parseImportFile` validates with Zod and rejects unsupported `schemaVersion`, floating-point price strings, missing required fields, and invalid datetimes
- Preview correctly classifies entries as new / unchanged / conflict
- Confirm button disabled when conflicts > 0 or new = 0
- Import is transactional — partial failure rolls back all entries
- Existing overlap rules enforced
- Historical event recalculation triggered for imported records
- `source` stored with imported records
- All prices remain decimal strings throughout — never `parseFloat()`
- Tests cover: parse/validation, preview classification, successful import, conflict detection, rollback, decimal precision, recalculation
