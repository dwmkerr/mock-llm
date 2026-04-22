#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Exercise refresh + revocation paths:
#   1. Issue short-lived token directly via /oauth/issue control endpoint.
#   2. Refresh it, confirm new access_token returned.
#   3. Revoke it, confirm next MCP call sees 401.

BASE="http://localhost:6556"

# Step 1: Configure OAuth with short-lived deterministic tokens.
# Reset any state left by a prior sample so deterministic queues start at index 0.
echo "Configuring OAuth fixture with 5s token lifetime..."
curl -fsSL -X POST "$BASE/oauth/reset" > /dev/null 2>&1 || true
curl -fsSL -X PATCH "$BASE/config" \
  -H "Content-Type: application/json" \
  -d '{
    "oauth": {
      "protectedPaths": ["/mcp"],
      "clients": [{
        "clientId": "refresh-client",
        "redirectUris": ["http://127.0.0.1:*"]
      }],
      "tokens": {
        "expiresInSeconds": 5,
        "refreshable": true,
        "rotateRefreshToken": true,
        "deterministic": {
          "nextAccessTokens": ["access-initial", "access-refreshed"],
          "nextRefreshTokens": ["refresh-initial", "refresh-rotated"]
        }
      },
      "metadata": {}
    }
  }' > /dev/null

# Step 2: Issue token directly (simulates stage-1 manual-token test)
echo "Issuing initial token..."
issued=$(curl -fsSL -X POST "$BASE/oauth/issue" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"refresh-client","scope":"mcp:read"}')

access=$(echo "$issued" | jq -r '.access_token')
refresh=$(echo "$issued" | jq -r '.refresh_token')
expires_in=$(echo "$issued" | jq -r '.expires_in')

[ "$access" = "access-initial" ] || { echo "failed: access=$access"; exit 1; }
[ "$refresh" = "refresh-initial" ] || { echo "failed: refresh=$refresh"; exit 1; }
[ "$expires_in" = "5" ] || { echo "failed: expires_in=$expires_in"; exit 1; }
echo "Issued access=$access refresh=$refresh expires_in=${expires_in}s"

# Step 3: Confirm token authorizes MCP
echo "Verifying token authorizes /mcp..."
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $access" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}},"id":1}')
[ "$status" = "200" ] || { echo "failed: initial token got $status"; exit 1; }
echo "Initial token OK (200)"

# Step 4: Refresh the access token
echo "Refreshing token..."
refreshed=$(curl -fsSL -X POST "$BASE/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=$refresh" \
  --data-urlencode "client_id=refresh-client")

new_access=$(echo "$refreshed" | jq -r '.access_token')
new_refresh=$(echo "$refreshed" | jq -r '.refresh_token')

[ "$new_access" = "access-refreshed" ] || { echo "failed: new_access=$new_access"; exit 1; }
[ "$new_refresh" = "refresh-rotated" ] || { echo "failed: new_refresh=$new_refresh"; exit 1; }
echo "Refreshed access=$new_access refresh=$new_refresh"

# Step 5: Old refresh_token must now be invalid (rotateRefreshToken=true)
echo "Verifying rotated refresh token is invalid..."
old_refresh_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=$refresh" \
  --data-urlencode "client_id=refresh-client")
[ "$old_refresh_status" = "400" ] || { echo "failed: old refresh expected 400, got $old_refresh_status"; exit 1; }
echo "Rotated refresh rejected (400)"

# Step 6: New access token authorizes MCP
echo "Verifying new access token authorizes /mcp..."
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $new_access" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}},"id":1}')
[ "$status" = "200" ] || { echo "failed: refreshed token got $status"; exit 1; }
echo "Refreshed token OK (200)"

# Step 7: Revoke via control endpoint, confirm 401 + WWW-Authenticate challenge
echo "Revoking refreshed token..."
curl -fsSL -X POST "$BASE/oauth/revoke" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$new_access\"}" > /dev/null

revoked_status=$(curl -s -o /dev/null -D /tmp/mcp-revoked-head.txt -w "%{http_code}" \
  -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $new_access" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}},"id":1}')
[ "$revoked_status" = "401" ] || { echo "failed: revoked token expected 401, got $revoked_status"; exit 1; }

www_auth=$(grep -i "^www-authenticate:" /tmp/mcp-revoked-head.txt | tr -d '\r')
echo "$www_auth" | grep -q 'error="invalid_token"' || { echo "failed: missing invalid_token error: $www_auth"; exit 1; }
echo "Revoked token rejected (401 invalid_token)"

# Step 8: Force-expire path via /oauth/expire
echo "Verifying /oauth/expire control endpoint..."
issued2=$(curl -fsSL -X POST "$BASE/oauth/issue" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"refresh-client"}')
access2=$(echo "$issued2" | jq -r '.access_token')

curl -fsSL -X POST "$BASE/oauth/expire" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$access2\"}" > /dev/null

expired_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $access2" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}},"id":1}')
[ "$expired_status" = "401" ] || { echo "failed: expired token expected 401, got $expired_status"; exit 1; }
echo "Force-expired token rejected (401)"

rm -f /tmp/mcp-revoked-head.txt

echo "passed"
