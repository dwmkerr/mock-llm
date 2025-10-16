#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Configure mock-llm to return a 401 error for all responses.
curl -fsSL -X POST http://localhost:6556/config \
  -H "Content-Type: application/x-yaml" \
  -d '
rules:
  - path: "/v1/chat/completions"
    match: "@"
    response:
      status: 401
      content: |
        {
          "error": {
            "message": "Incorrect API key provided.",
            "type": "invalid_request_error",
            "param": null,
            "code": "invalid_api_key"
          }
        }' > /dev/null

# Send a request - expect a 401 response.
response=$(curl -sSL -w "\n%{http_code}" -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "error-401"}]
  }')

# Extract status code and body.
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Expected response.
expected='{
  "error": {
    "message": "Incorrect API key provided.",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}'

# Fail if status code is not expected or response doesn't match expected.
[[ "$status_code" == "401" ]] || { echo "failed: expected status 401, got $status_code"; exit 1; }
diff_output=$(diff <(echo "$expected" | jq .) <(echo "$body" | jq .) 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
