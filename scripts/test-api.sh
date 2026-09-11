#!/usr/bin/env bash
# Usage:
#   ./scripts/test-api.sh <API_KEY> [BASE_URL]               — built-in smoke tests
#   ./scripts/test-api.sh <API_KEY> [BASE_URL] --dir <path>  — send all *.json in folder

set -euo pipefail

API_KEY="${1:?Usage: $0 <API_KEY> [BASE_URL] [--dir <path>]}"
BASE_URL="${2:-http://localhost:8096}"

# Parse --dir flag from remaining args
DIR=""
shift 2 2>/dev/null || shift $# 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="${2:?--dir requires a path}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

echo "=== Health check ==="
curl -sf "$BASE_URL/api/health" | jq .

# ── Folder mode ───────────────────────────────────────────────────────────────
if [[ -n "$DIR" ]]; then
  echo ""
  echo "=== Sending JSON files from: $DIR ==="
  ok=0; fail=0
  for f in "$DIR"/*.json; do
    [[ -f "$f" ]] || { echo "No .json files found in $DIR"; exit 1; }
    echo ""
    echo "--- $(basename "$f") ---"
    status=$(curl -s -o /tmp/_obs_resp.json -w "%{http_code}" -X POST "$BASE_URL/api/v1/events" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary "@$f")
    cat /tmp/_obs_resp.json | jq .
    if [[ "$status" == "200" ]]; then ((ok++)); else ((fail++)); fi
    echo "HTTP $status"
  done
  echo ""
  echo "Done. ok=$ok fail=$fail"
  exit 0
fi

# ── Smoke tests ───────────────────────────────────────────────────────────────
EVENT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo ""
echo "=== Ingest event (success) ==="
curl -sf -X POST "$BASE_URL/api/v1/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"durationMs\": 1234,
    \"environment\": \"test\",
    \"feature\": \"test-feature\",
    \"operation\": \"chat\",
    \"operationId\": \"op-$(uuidgen | tr '[:upper:]' '[:lower:]')\",
    \"attemptNumber\": 1,
    \"status\": \"success\",
    \"provider\": \"anthropic\",
    \"requestedModel\": \"claude-sonnet-4-6\",
    \"reportedModel\": \"claude-sonnet-4-6\",
    \"usage\": {
      \"inputTokens\": 100,
      \"cachedInputTokens\": 0,
      \"outputTokens\": 50
    }
  }" | jq .

echo ""
echo "=== Duplicate event (same eventId → duplicate: true) ==="
curl -sf -X POST "$BASE_URL/api/v1/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"durationMs\": 999,
    \"environment\": \"test\",
    \"feature\": \"test-feature\",
    \"operation\": \"chat\",
    \"operationId\": \"op-$(uuidgen | tr '[:upper:]' '[:lower:]')\",
    \"attemptNumber\": 1,
    \"status\": \"success\",
    \"provider\": \"anthropic\",
    \"requestedModel\": \"claude-sonnet-4-6\"
  }" | jq .

echo ""
echo "=== Auth failure (wrong key) ==="
curl -s -X POST "$BASE_URL/api/v1/events" \
  -H "Authorization: Bearer invalid_key" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"00000000-0000-0000-0000-000000000000"}' | jq .

echo ""
echo "=== Validation error (missing required fields) ==="
curl -s -X POST "$BASE_URL/api/v1/events" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"not-a-uuid"}' | jq .

echo ""
echo "Done. EVENT_ID=$EVENT_ID"
