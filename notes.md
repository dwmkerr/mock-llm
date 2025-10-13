# A2A Protocol Implementation Notes

## Overview
Transform mock-llm server into an A2A-compliant agent by adding Agent Card discovery and basic A2A endpoints.

## Agent Card - First Step

**Endpoint**: `/.well-known/agent.json` (current standard, not agent-card.json)
- Must be accessible via GET request
- Returns JSON document describing agent identity and capabilities

## Minimal Agent Card Structure

```json
{
  "name": "Mock LLM Agent",
  "description": "Mock OpenAI-compatible API server for testing AI applications",
  "url": "http://localhost:8080",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false
  },
  "defaultInputModes": ["application/json"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "chat_completion",
      "name": "Chat Completion",
      "description": "Provides deterministic chat completions for testing",
      "inputModes": ["application/json"],
      "outputModes": ["application/json"]
    }
  ]
}
```

## Required Changes to mock-llm Server

### 1. Add Agent Card Endpoint (server.ts)
Add before the catch-all POST handler (line 60):
```typescript
app.get('/.well-known/agent.json', (req, res) => {
  res.json({
    name: 'Mock LLM Agent',
    description: 'Mock OpenAI-compatible API server for testing AI applications',
    url: `http://${req.hostname}:${PORT}`,
    version: pkg.version,
    capabilities: {
      streaming: false,
      pushNotifications: false
    },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'chat_completion',
        name: 'Chat Completion',
        description: 'Provides deterministic chat completions for testing',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      }
    ]
  });
});
```

### 2. Optional: Add Basic A2A Endpoints

If we want full A2A compliance, add these endpoints:

**POST /a2a/message/send**
- Accepts A2A message format
- Returns task ID and initial response

**GET /a2a/tasks/:taskId**
- Returns task status and results

**POST /a2a/tasks/:taskId/cancel**
- Cancels running task

## Implementation Priority

1. **Phase 1 (Minimal)**: Add `/.well-known/agent.json` endpoint only
   - Makes server discoverable as A2A agent
   - No behavior changes to existing endpoints

2. **Phase 2 (Optional)**: Add A2A protocol endpoints
   - Implement message/send, tasks/get, tasks/cancel
   - Map to existing chat completion logic

## Key A2A Concepts

### Agent Card Fields
- `name`: Human-readable agent name
- `description`: Brief description of purpose
- `url`: Base URL where agent is hosted
- `version`: Agent version
- `capabilities`: Protocol features (streaming, pushNotifications)
- `skills`: Array of detailed capability descriptions with examples
- `securitySchemes` (optional): Authentication methods
- `defaultInputModes`: Content types agent accepts
- `defaultOutputModes`: Content types agent produces

### Skills Section
The skills section is critical for agent-to-agent discovery:
- Describe what the agent can do
- Include input/output modes for each skill
- Provide examples showing request/response patterns
- Be as descriptive as possible about reasoning and behavior

## Testing

```bash
# Test Agent Card endpoint
curl http://localhost:8080/.well-known/agent.json

# Expected: JSON response with agent metadata
```

## Current Server Architecture

- Express.js server (src/server.ts)
- Rule-based request matching using JMESPath
- Template-based response generation
- Config management via REST endpoints
- Main entry point: src/main.ts (PORT env var, default 8080)

## Next Steps

1. Add `/.well-known/agent.json` GET handler
2. Test endpoint accessibility
3. Decide if full A2A protocol endpoints are needed
