# MCP Support

Mock LLM includes support for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) for testing MCP operations.

## Quickstart

Start the server. Available MCP endpoint will be shown:

```bash
npm install -g mock-llm
mock-llm

# Loaded MCP server:
#   - echo-mcp: http://0.0.0.0:6556/mcp
#     - echo: this tool echoes back the provided request
# @dwmkerr/mock-llm v0.1.x server running on 0.0.0.0:6556
```

## MCP Tools

### Echo Tool

The echo tool accepts text input and returns it unchanged, useful for testing basic MCP connectivity and tool invocation.

### Testing with curl

The MCP server uses Streamable HTTP transport, which returns responses in event stream format.

Initialize a session:

```bash
curl -N -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
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
  }'
```

Response (event stream format):

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"echo-mcp","version":"1.0.0"}}}
```

The session ID is returned in the `mcp-session-id` response header.

List available tools (use session ID from previous response):

```bash
curl -N -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: YOUR-SESSION-ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
```

Call the echo tool:

```bash
curl -N -X POST http://localhost:6556/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: YOUR-SESSION-ID" \
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
  }'
```

Response:

```
event: message
data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Hello, MCP!"}]}}
```

Terminate the session:

```bash
curl -X DELETE http://localhost:6556/mcp/ \
  -H "mcp-session-id: YOUR-SESSION-ID"
```

## MCP Inspector

The MCP Inspector can be used to interact with the server:

```bash
npm run local:inspect
```

This launches the `@modelcontextprotocol/inspector` for visual debugging and testing.

## Further Reading

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
