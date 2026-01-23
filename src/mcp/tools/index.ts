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

  server.tool(
    'wait',
    'waits for the specified number of milliseconds',
    {
      milliseconds: z.number().positive().describe('the number of milliseconds to wait'),
    },
    async ({ milliseconds }): Promise<CallToolResult> => {
      await new Promise(resolve => setTimeout(resolve, milliseconds));
      return {
        content: [
          {
            type: 'text',
            text: `Waited for ${milliseconds}ms`
          }
        ]
      }
    }
  );
  tools.push({ name: 'wait', description: 'waits for the specified number of milliseconds' });

  server.tool(
    'bitcoin_historical_prices',
    'fetches Bitcoin historical prices from the sample API',
    {
      samples: z.number().positive().describe('the number of samples to retrieve').default(100),
    },
    async ({samples}): Promise<CallToolResult> => {
      try {
        const response = await fetch('https://api.sampleapis.com/bitcoin/historical_prices');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data && Array.isArray(data)) {
          // duplicate data to increase size
          const originalLength = data.length;
          let dayOffset = 0;

          while (data.length < samples) {
            dayOffset++;
            for (let i = 0; i < originalLength && data.length < 10000; i++) {
              const item = data[i];
              // Parse date in MM/dd/yyyy format
              const [month, day, year] = item.Date.split('/').map(Number);
              const date = new Date(year, month - 1, day);
              // Add dayOffset days
              date.setDate(date.getDate() + dayOffset);
              // Format back to MM/dd/yyyy
              const newDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;

              data.push({
                ...item,
                Date: newDate,
              });
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching Bitcoin prices: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
  tools.push({ name: 'bitcoin_historical_prices', description: 'fetches Bitcoin historical prices from the sample API' });

  server.tool(
    'count_items',
    'counts the number of items in a provided JSON array',
    {
      jsonItems: z.string().describe('a JSON array of items to count'),
    },
    async ({jsonItems}): Promise<CallToolResult> => {
      const items = JSON.parse(jsonItems);
      
      try {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items.length, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching Bitcoin prices: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
  tools.push({ name: 'count_items', description: 'counts the number of items in a provided JSON array' });

  return tools;
}
