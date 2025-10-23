import { z } from 'zod'
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function configureTools(server: McpServer): void {
  console.log('Configuring MCP tools:');

  server.tool(
    'echo',
    'this tool echoes back the provided request',
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
}
