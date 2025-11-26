#!/usr/bin/env bash
set -eo pipefail

# Demonstrates sequential responses for tool-calling flows.
# First request returns a tool call, second request returns final answer.

# Configure mock-llm with sequential rules
curl -fsSL -X POST http://localhost:6556/config \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "path": "/v1/chat/completions",
        "sequence": 0,
        "response": {
          "status": 200,
          "content": "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"{\\\"location\\\":\\\"NYC\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}]}"
        }
      },
      {
        "path": "/v1/chat/completions",
        "sequence": 1,
        "response": {
          "status": 200,
          "content": "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"The weather in NYC is 72°F and sunny.\"},\"finish_reason\":\"stop\"}]}"
        }
      }
    ]
  }' > /dev/null

# First request - should get tool call
response1=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "What is the weather?"}]}')

finish_reason1=$(echo "$response1" | jq -r '.choices[0].finish_reason')
tool_name=$(echo "$response1" | jq -r '.choices[0].message.tool_calls[0].function.name')

if [ "$finish_reason1" != "tool_calls" ] || [ "$tool_name" != "get_weather" ]; then
  echo "failed: expected tool_calls with get_weather, got: $response1"
  exit 1
fi

# Second request - should get final answer
response2=$(curl -fsSL -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "tool", "content": "72F sunny"}]}')

finish_reason2=$(echo "$response2" | jq -r '.choices[0].finish_reason')
content=$(echo "$response2" | jq -r '.choices[0].message.content')

if [ "$finish_reason2" != "stop" ] || [ "$content" != "The weather in NYC is 72°F and sunny." ]; then
  echo "failed: expected final answer, got: $response2"
  exit 1
fi

# Reset config
curl -fsSL -X DELETE http://localhost:6556/config > /dev/null

echo "passed"
