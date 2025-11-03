import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { configureTools, ToolInfo } from './tools';

export interface MCPServerInfo {
  server: McpServer;
  name: string;
  tools: ToolInfo[];
}

export function getMCPServer(): MCPServerInfo {
  const server = new McpServer({
    name: "echo-mcp",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  const tools = configureTools(server);

  return { server, name: "echo-mcp", tools };
}

