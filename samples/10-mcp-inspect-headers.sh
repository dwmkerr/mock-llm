#!/usr/bin/env bash
set -eo pipefail

# Test MCP echo_headers tool returns HTTP headers as JSON.

# Initialize session
init_response=$(curl -fsSL -N -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D /tmp/mcp-headers.txt \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' \
  | sed -n 's/^data: //p' | head -1)

session_id=$(grep -i "mcp-session-id:" /tmp/mcp-headers.txt | cut -d' ' -f2 | tr -d '\r')
[ -z "$session_id" ] && { echo "failed: no session ID"; exit 1; }

# Call echo_headers with custom headers
response=$(curl -fsSL -N -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $session_id" \
  -H "Authorization: Bearer test-token-123" \
  -H "X-Custom-Header: test-value" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo_headers","arguments":{}},"id":2}' \
  | sed -n 's/^data: //p' | head -1)

# Verify headers present
headers=$(echo "$response" | jq -r '.result.content[0].text')
echo "$headers" | jq -e '.authorization' > /dev/null || { echo "failed: no auth header"; exit 1; }

auth=$(echo "$headers" | jq -r '.authorization')
[ "$auth" = "Bearer test-token-123" ] || { echo "failed: wrong auth value"; exit 1; }

echo "$headers" | jq -e '."x-custom-header"' > /dev/null || { echo "failed: no custom header"; exit 1; }

custom=$(echo "$headers" | jq -r '."x-custom-header"')
[ "$custom" = "test-value" ] || { echo "failed: wrong custom value"; exit 1; }

# Cleanup
curl -fsSL -X DELETE http://localhost:6556/mcp/ -H "mcp-session-id: $session_id" > /dev/null
rm -f /tmp/mcp-headers.txt

echo "passed"
