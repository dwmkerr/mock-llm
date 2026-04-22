#!/usr/bin/env bash
set -eo pipefail

# Verify mock-llm serves HTTPS when MOCK_LLM_TLS_ENABLED=true and cert/key
# paths are supplied. Runs an isolated mock-llm on a separate port so it does
# not collide with the sample-suite's shared HTTP server on 6556.

PORT=6557
TMPDIR=$(mktemp -d)
CERT="$TMPDIR/tls.crt"
KEY="$TMPDIR/tls.key"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

echo "Generating self-signed cert at $CERT..."
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" \
  -out "$CERT" \
  -days 1 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  >/dev/null 2>&1

echo "Starting mock-llm with TLS on port $PORT..."
MOCK_LLM_TLS_ENABLED=true \
  MOCK_LLM_TLS_CERT="$CERT" \
  MOCK_LLM_TLS_KEY="$KEY" \
  PORT=$PORT \
  node dist/main.js >"$TMPDIR/server.log" 2>&1 &
SERVER_PID=$!

# Wait for readiness (max ~5s). Use the real cert via --cacert; if the server
# crashed we exit via pipefail + the log tail at the end.
for _ in $(seq 1 50); do
  if curl -fsS --cacert "$CERT" "https://localhost:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

echo "Checking scheme is HTTPS..."
grep -q "https://" "$TMPDIR/server.log" || {
  echo "failed: startup log does not advertise https://"
  cat "$TMPDIR/server.log"
  exit 1
}

echo "Probing /health over HTTPS with CA pinned..."
status=$(curl -s -o /dev/null -w "%{http_code}" \
  --cacert "$CERT" \
  "https://localhost:$PORT/health")
[ "$status" = "200" ] || { echo "failed: expected 200, got $status"; exit 1; }
echo "HTTPS /health -> 200 OK"

echo "Verifying plain HTTP is rejected on the TLS port..."
if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "failed: HTTP request unexpectedly succeeded against TLS listener"
  exit 1
fi
echo "Plain HTTP rejected as expected"

echo "Verifying untrusted cert is rejected without --cacert..."
if curl -fsS "https://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "failed: TLS verification unexpectedly passed without --cacert"
  exit 1
fi
echo "Untrusted cert rejected as expected"

echo "TLS sample passed"
