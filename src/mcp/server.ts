import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { configureTools } from './tools';

export function getMCPServer(): McpServer {
  const server = new McpServer({
    name: "echo-mcp",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  configureTools(server);

  return server;
}

