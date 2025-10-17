# A2A Protocol Support

Mock LLM includes basic support for the [A2A (Agent-to-Agent) protocol](https://a2a-protocol.org) for testing messages, tasks, and asynchronous workflows.

## Quickstart

Start the server. Available agents will be shown:

```bash
npm install -g mock-llm
mock-llm

# Loaded configuration from /Users/Dave_Kerr/repos/github/dwmkerr/mock-llm/mock-llm.yaml
# - rule 1, match: @
# Loaded A2A agents:
# - countdown-agent: /a2a/agents/countdown-agent/.well-known/agent-card.json
# @dwmkerr/mock-llm v0.1.12 server running on 0.0.0.0:6556
```

## A2A Agents

**Countdown Agent**

The countdown agent extracts a number from the message and counts down from 30 seconds, one message update each ten seconds, until the last ten seconds which are each second. If the incoming message includes a number, then that number will be used for the duration of the countdown.

## Testing with curl

Get the agent card:

```bash
curl http://localhost:6556/a2a/agents/countdown-agent/.well-known/agent-card.json
```

Send a message to create a task (non-blocking). If `blocking` is set to `true` the server will not send a response until the task is complete:

```bash
curl -X POST http://localhost:6556/a2a/agents/countdown-agent/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "configuration": {
        "blocking": false
      },
      "message": {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [{"kind": "text", "text": "Countdown from 30"}]
      }
    },
    "id": 1
  }'
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "kind": "task",
    "id": "f9f66fa5-91af-462a-a77e-905bc014b822",
    "contextId": "5435ec8c-ac38-4371-bdf4-63872ca9b339",
    "status": {
      "state": "submitted",
      "timestamp": "2025-10-16T12:55:03.884Z"
    },
    "history": [
      {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Countdown from 30"
          }
        ],
        "contextId": "5435ec8c-ac38-4371-bdf4-63872ca9b339"
      }
    ]
  }
}
```

Get task status (use the task id returned from the call above):

```bash
task_id="your-task-id"
curl -X POST http://localhost:6556/a2a/agents/countdown-agent/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/get",
    "params": {
      "id": "${task_id}"
    },
    "id": 2
  }'
```

Response:

```
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "kind": "task",
    "id": "51bfb842-44db-4a6f-92dc-f64e95be99ba",
    "contextId": "d1d4232c-6266-4d19-b089-24884053ad8c",
    "status": {
      "state": "working",
      "message": {
        "kind": "message",
        "role": "agent",
        "messageId": "8a426e3b-fc6c-4fed-a0bb-bce26395165e",
        "parts": [
          {
            "kind": "text",
            "text": "10 seconds remaining..."
          }
        ],
        "taskId": "51bfb842-44db-4a6f-92dc-f64e95be99ba",
        "contextId": "d1d4232c-6266-4d19-b089-24884053ad8c"
      },
      "timestamp": "2025-10-16T12:57:04.878Z"
    },
    "history": []
  }
}
```

Stream task updates:

```bash
curl -N http://localhost:6556/a2a/agents/countdown-agent/stream/task-abc123
```

If a negative number is provided in the message, the countdown agent will return a task in the `failed` state, which allows for testing error scenarios.

Example response for negative number:

```json
{
  "kind": "statusUpdate",
  "taskId": "task-123",
  "contextId": "ctx-123",
  "status": {
    "state": "failed",
    "message": {
      "kind": "message",
      "role": "agent",
      "messageId": "msg-456",
      "parts": [
        {
          "kind": "text",
          "text": "Cannot countdown from negative number -5"
        }
      ],
      "taskId": "task-123",
      "contextId": "ctx-123"
    },
    "timestamp": "2025-10-17T12:00:00.000Z"
  },
  "final": true
}
```

**Echo Agent**

The echo agent immediately responds with a `message` object that echo's the user's message.

## A2A Inspector

The [A2A Inspector](https://github.com/a2aproject/a2a-inspector) can be used to communicate with the agent. Run the inspector:

```bash
git clone https://github.com/a2aproject/a2a-inspector.git
cd a2a-inspector
bash scripts/run.sh
```

Open the inspector at `http://127.0.0.1:5001` and enter the agent URL from the startup message.

## Further Reading

- [A2A Protocol Specification](https://a2a-protocol.org)
- [A2A JavaScript SDK](https://github.com/a2aproject/a2a-js-sdk)
