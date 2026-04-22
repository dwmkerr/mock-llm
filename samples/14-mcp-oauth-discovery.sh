#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Test OAuth discovery: 401 challenge on protected MCP path and both
# RFC 9728 / RFC 8414 well-known metadata documents.

BASE="http://localhost:6556"

# Step 1: Enable Bearer gate on /mcp. Discovery endpoints and issuer metadata
# are mounted at boot, so only protectedPaths needs toggling here.
echo "Enabling OAuth gate on /mcp..."
curl -fsSL -X PATCH "$BASE/config" \
  -H "Content-Type: application/json" \
  -d '{"oauth": {"protectedPaths": ["/mcp"]}}' > /dev/null

# Step 2: Unauthenticated MCP initialize must return 401 with RFC 9728 challenge
echo "Probing /mcp without Bearer..."
status=$(curl -s -o /tmp/mcp-oauth-body.txt -D /tmp/mcp-oauth-head.txt \
  -w "%{http_code}" -X POST "$BASE/mcp/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}},"id":1}')

if [ "$status" != "401" ]; then
  echo "failed: expected 401, got $status"
  exit 1
fi
echo "Got 401 as expected"

www_auth=$(grep -i "^www-authenticate:" /tmp/mcp-oauth-head.txt | tr -d '\r')
echo "$www_auth" | grep -q 'Bearer error="invalid_token"' || { echo "failed: missing invalid_token error"; exit 1; }
echo "$www_auth" | grep -q 'resource_metadata=' || { echo "failed: missing resource_metadata"; exit 1; }
echo "WWW-Authenticate OK: $www_auth"

# Step 3: RFC 9728 protected resource metadata (served at resource-path-suffixed URL per RFC 9728 §3.2)
echo "Fetching /.well-known/oauth-protected-resource/mcp..."
pr_meta=$(curl -fsSL "$BASE/.well-known/oauth-protected-resource/mcp")

resource=$(echo "$pr_meta" | jq -r '.resource')
resource_name=$(echo "$pr_meta" | jq -r '.resource_name')
auth_server=$(echo "$pr_meta" | jq -r '.authorization_servers[0]')

# Strip trailing slashes on issuer-style URLs (URL.href normalises to include one).
[ "${resource%/}" = "http://localhost:6556/mcp" ] || { echo "failed: resource=$resource"; exit 1; }
[ "$resource_name" = "Mock MCP Resource" ] || { echo "failed: resource_name=$resource_name"; exit 1; }
[ "${auth_server%/}" = "http://localhost:6556" ] || { echo "failed: auth_server=$auth_server"; exit 1; }
echo "RFC 9728 document OK"

# Step 4: RFC 8414 authorization server metadata
echo "Fetching /.well-known/oauth-authorization-server..."
as_meta=$(curl -fsSL "$BASE/.well-known/oauth-authorization-server")

issuer=$(echo "$as_meta" | jq -r '.issuer')
auth_ep=$(echo "$as_meta" | jq -r '.authorization_endpoint')
token_ep=$(echo "$as_meta" | jq -r '.token_endpoint')
reg_ep=$(echo "$as_meta" | jq -r '.registration_endpoint')
pkce=$(echo "$as_meta" | jq -r '.code_challenge_methods_supported | index("S256")')
grants=$(echo "$as_meta" | jq -r '.grant_types_supported | sort | join(",")')

[ "${issuer%/}" = "http://localhost:6556" ] || { echo "failed: issuer=$issuer"; exit 1; }
[ "$auth_ep" = "http://localhost:6556/authorize" ] || { echo "failed: auth_ep=$auth_ep"; exit 1; }
[ "$token_ep" = "http://localhost:6556/token" ] || { echo "failed: token_ep=$token_ep"; exit 1; }
[ "$reg_ep" = "http://localhost:6556/register" ] || { echo "failed: reg_ep=$reg_ep"; exit 1; }
[ "$pkce" != "null" ] || { echo "failed: S256 not advertised"; exit 1; }
[ "$grants" = "authorization_code,refresh_token" ] || { echo "failed: grants=$grants"; exit 1; }
echo "RFC 8414 document OK"

rm -f /tmp/mcp-oauth-body.txt /tmp/mcp-oauth-head.txt

echo "passed"
