#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Send a blocking A2A message/send request to countdown-agent.
# With blocking (default), the request waits until the task completes.

response=$(curl -fsSL -X POST http://localhost:6556/a2a/agents/countdown-agent/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Countdown from 3"
          }
        ]
      }
    },
    "id": 1
  }')

# Verify the response contains a completed task
task_state=$(echo "$response" | jq -r '.result.status.state')
if [ "$task_state" != "completed" ]; then
  echo "failed: expected task state 'completed', got '$task_state'"
  exit 1
fi

# Verify the final message contains "complete"
final_message=$(echo "$response" | jq -r '.result.status.message.parts[0].text')
if [[ ! "$final_message" =~ "complete" ]]; then
  echo "failed: expected final message to contain 'complete', got '$final_message'"
  exit 1
fi

echo "passed"
