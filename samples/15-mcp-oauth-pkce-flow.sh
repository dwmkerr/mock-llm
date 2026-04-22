#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Full OAuth 2.1 Authorization Code + PKCE flow:
# DCR -> authorize -> token exchange -> authenticated MCP initialize.
# Uses deterministic fixture values so assertions compare exact strings.

BASE="http://localhost:6556"
REDIRECT="http://127.0.0.1:39999/callback"

# Step 1: Configure OAuth with deterministic tokens / codes / clients.
# Reset any state left by a prior sample so deterministic queues start at index 0.
echo "Configuring OAuth fixture..."
curl -fsSL -X POST "$BASE/oauth/reset" > /dev/null 2>&1 || true
curl -fsSL -X PATCH "$BASE/config" \
  -H "Content-Type: application/json" \
  -d '{
    "oauth": {
      "protectedPaths": ["/mcp"],
      "tokens": {
        "expiresInSeconds": 3600,
        "refreshable": true,
        "deterministic": {
          "nextAccessTokens": ["fixture-access-001"],
          "nextRefreshTokens": ["fixture-refresh-001"],
          "nextAuthorizationCodes": ["fixture-code-001"],
          "nextClientIds": ["fixture-client-001"],
          "nextClientSecrets": ["fixture-secret-001"]
        }
      },
      "metadata": {
        "registrationEndpointEnabled": true,
        "scopesSupported": ["mcp:read", "mcp:tools"]
      }
    }
  }' > /dev/null

# Step 2: Dynamic Client Registration (RFC 7591)
echo "Registering client via DCR..."
reg=$(curl -fsSL -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_name\": \"ark-cli\",
    \"redirect_uris\": [\"$REDIRECT\"],
    \"grant_types\": [\"authorization_code\", \"refresh_token\"],
    \"response_types\": [\"code\"],
    \"token_endpoint_auth_method\": \"none\",
    \"scope\": \"mcp:read mcp:tools\"
  }")

client_id=$(echo "$reg" | jq -r '.client_id')
[ "$client_id" = "fixture-client-001" ] || { echo "failed: client_id=$client_id"; exit 1; }
echo "client_id=$client_id"

# Step 3: Generate PKCE verifier + S256 challenge
echo "Generating PKCE pair..."
code_verifier=$(openssl rand 32 | openssl base64 | tr '+/' '-_' | tr -d '=\n')
code_challenge=$(printf '%s' "$code_verifier" \
  | openssl dgst -sha256 -binary \
  | openssl base64 | tr '+/' '-_' | tr -d '=\n')
state="state-$RANDOM"

# Step 4: Authorization endpoint - expect 302 with code+state on redirect_uri
echo "Calling /authorize..."
authorize_url="$BASE/authorize?response_type=code&client_id=$client_id&redirect_uri=$(printf %s "$REDIRECT" | jq -sRr @uri)&scope=mcp%3Aread&state=$state&code_challenge=$code_challenge&code_challenge_method=S256"

location=$(curl -s -o /dev/null -w "%{redirect_url}" "$authorize_url")
[ -n "$location" ] || { echo "failed: no Location header"; exit 1; }

# Extract code + state from redirect query
code=$(printf '%s' "$location" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
returned_state=$(printf '%s' "$location" | sed -n 's/.*[?&]state=\([^&]*\).*/\1/p')

[ "$code" = "fixture-code-001" ] || { echo "failed: code=$code"; exit 1; }
[ "$returned_state" = "$state" ] || { echo "failed: state mismatch"; exit 1; }
echo "Got code=$code state=$returned_state"

# Step 5: Token endpoint - exchange code + verifier for tokens
echo "Exchanging code for tokens..."
tokens=$(curl -fsSL -X POST "$BASE/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$code" \
  --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "code_verifier=$code_verifier")

access_token=$(echo "$tokens" | jq -r '.access_token')
refresh_token=$(echo "$tokens" | jq -r '.refresh_token')
token_type=$(echo "$tokens" | jq -r '.token_type')
expires_in=$(echo "$tokens" | jq -r '.expires_in')

[ "$access_token" = "fixture-access-001" ] || { echo "failed: access_token=$access_token"; exit 1; }
[ "$refresh_token" = "fixture-refresh-001" ] || { echo "failed: refresh_token=$refresh_token"; exit 1; }
[ "$token_type" = "Bearer" ] || { echo "failed: token_type=$token_type"; exit 1; }
[ "$expires_in" = "3600" ] || { echo "failed: expires_in=$expires_in"; exit 1; }
echo "Tokens OK: access=$access_token refresh=$refresh_token"

# Step 6: Negative - reused code must fail
echo "Verifying code cannot be replayed..."
replay_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$code" \
  --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "code_verifier=$code_verifier")
[ "$replay_status" = "400" ] || { echo "failed: replay expected 400, got $replay_status"; exit 1; }
echo "Code replay rejected (400)"

# Step 7: Authenticated MCP initialize - must succeed
echo "Initializing MCP with Bearer token..."
init_response=$(curl -fsSL -N -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $access_token" \
  -D /tmp/mcp-oauth-init.txt \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' \
  | grep "^data: " | head -1 | sed 's/^data: //')

protocol=$(echo "$init_response" | jq -r '.result.protocolVersion')
[ -n "$protocol" ] && [ "$protocol" != "null" ] || { echo "failed: no protocolVersion in init response"; exit 1; }
echo "MCP initialize OK (protocolVersion=$protocol)"

session_id=$(grep -i "mcp-session-id:" /tmp/mcp-oauth-init.txt | cut -d' ' -f2 | tr -d '\r')
curl -fsSL -X DELETE "$BASE/mcp/" \
  -H "Authorization: Bearer $access_token" \
  -H "mcp-session-id: $session_id" > /dev/null

rm -f /tmp/mcp-oauth-init.txt

echo "passed"
