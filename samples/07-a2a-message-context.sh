#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Send first message to message-counter-agent.
# The agent tracks message count per contextId.

# Use unique contextId for test isolation
TEST_CONTEXT="test-context-$(date +%s)-$$"

response1=$(curl -fsSL -X POST http://localhost:6556/a2a/agents/message-counter-agent/ \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"message/send\",
    \"params\": {
      \"message\": {
        \"messageId\": \"msg-1\",
        \"kind\": \"message\",
        \"role\": \"user\",
        \"contextId\": \"$TEST_CONTEXT\",
        \"parts\": [
          {
            \"kind\": \"text\",
            \"text\": \"First message\"
          }
        ]
      }
    },
    \"id\": 1
  }")

# Verify first response shows 1 message
count1=$(echo "$response1" | jq -r '.result.parts[0].text')
if [ "$count1" != "1 message(s) received" ]; then
  echo "failed: expected '1 message(s) received', got '$count1'"
  exit 1
fi

# Send second message with same contextId
response2=$(curl -fsSL -X POST http://localhost:6556/a2a/agents/message-counter-agent/ \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"message/send\",
    \"params\": {
      \"message\": {
        \"messageId\": \"msg-2\",
        \"kind\": \"message\",
        \"role\": \"user\",
        \"contextId\": \"$TEST_CONTEXT\",
        \"parts\": [
          {
            \"kind\": \"text\",
            \"text\": \"Second message\"
          }
        ]
      }
    },
    \"id\": 2
  }")

# Verify second response shows 2 messages
count2=$(echo "$response2" | jq -r '.result.parts[0].text')
if [ "$count2" != "2 message(s) received" ]; then
  echo "failed: expected '2 message(s) received', got '$count2'"
  exit 1
fi

echo "passed"
