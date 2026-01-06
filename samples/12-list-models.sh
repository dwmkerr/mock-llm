#!/usr/bin/env bash
set -eo pipefail

# Ensure 'mock-llm' is running first, e.g:
# npm install -g @dwmkerr/mock-llm
# mock-llm

# Default config includes a GET /v1/models endpoint that returns available models.
# This is useful for clients that check model availability before making requests.

# Send a GET request to list models.
response=$(curl -fsSL http://localhost:6556/v1/models)

# Expect a list response containing mock models.
expected='{
  "object": "list",
  "data": [
    {"id": "gpt-5.2", "object": "model", "owned_by": "openai"}
  ]
}'

# Fail if response doesn't match expected.
diff_output=$(diff <(echo "$expected" | jq -S .) <(echo "$response" | jq -S .) 2>&1) && echo "passed" || { echo -e "failed:\n${diff_output}"; exit 1; }
