import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { configureTools } from ".";

describe('MCP Tools', () => {
  it('echo tool should be in tools/list', async () => {
    const client = await getMcpServerClientStub();

    await client.request(
      {
        method: 'tools/list',
      },
      ListToolsResultSchema
    )

    expect.arrayContaining([
      expect.objectContaining({
        name: 'echo',
        description: 'this tool echoes back the provided request',
      })
    ]);
  });

  it('echo tool should return the provided text', async () => {
    const client = await getMcpServerClientStub();

    const response = await client.request({
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: {
          text: 'Hello, MCP!'
        }
      }
    }, CallToolResultSchema);

    expect(response.content).toEqual([
      {
        type: 'text',
        text: 'Hello, MCP!'
      }
    ]);
  });
});

async function getMcpServerClientStub(): Promise<Client> {
  const server = new McpServer({
    name: "test-mcp",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  })

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  })

  configureTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.server.connect(serverTransport),
  ]);

  return client;
}