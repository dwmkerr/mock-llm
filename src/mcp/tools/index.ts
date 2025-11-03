import { z } from 'zod'
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { currentRequestHeaders } from '../request-context';

export interface ToolInfo {
  name: string;
  description: string;
}

export function configureTools(server: McpServer): ToolInfo[] {
  const tools: ToolInfo[] = [];

  server.tool(
    'echo',
    'echoes back the provided request',
    {
      text: z.string().describe('the text to echo back'),
    },
    async ({ text }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: 'text',
            text: text
          }
        ]
      }
    }
  );
  tools.push({ name: 'echo', description: 'echoes back the provided request' });

  server.tool(
    'echo_headers',
    'returns HTTP headers as JSON',
    {},
    async (): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(currentRequestHeaders)
          }
        ]
      }
    }
  );
  tools.push({ name: 'echo_headers', description: 'returns HTTP headers as JSON' });

  return tools;
}
