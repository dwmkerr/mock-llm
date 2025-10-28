#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Test the MCP echo tool by initializing a session, listing tools, calling echo, and terminating.

# Step 1: Initialize session
echo "Initializing MCP session..."
init_response=$(curl -fsSL -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -D /tmp/mcp-headers.txt \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }')

# Extract session ID from response headers
session_id=$(grep -i "mcp-session-id:" /tmp/mcp-headers.txt | cut -d' ' -f2 | tr -d '\r')
if [ -z "$session_id" ]; then
  echo "failed: no session ID returned"
  exit 1
fi
echo "Session ID: $session_id"

# Step 2: List available tools
echo "Listing available tools..."
tools_response=$(curl -fsSL -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }')

# Verify echo tool exists
tool_name=$(echo "$tools_response" | jq -r '.result.tools[0].name')
if [ "$tool_name" != "echo" ]; then
  echo "failed: expected tool 'echo', got '$tool_name'"
  exit 1
fi
echo "Found tool: $tool_name"

# Step 3: Call the echo tool
echo "Calling echo tool..."
call_response=$(curl -fsSL -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $session_id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "text": "Hello, MCP!"
      }
    },
    "id": 3
  }')

# Verify the echoed text
echoed_text=$(echo "$call_response" | jq -r '.result.content[0].text')
if [ "$echoed_text" != "Hello, MCP!" ]; then
  echo "failed: expected 'Hello, MCP!', got '$echoed_text'"
  exit 1
fi
echo "Echo response: $echoed_text"

# Step 4: Terminate session
echo "Terminating session..."
curl -fsSL -X DELETE http://localhost:6556/mcp/ \
  -H "mcp-session-id: $session_id" > /dev/null

# Cleanup
rm -f /tmp/mcp-headers.txt

echo "passed"
