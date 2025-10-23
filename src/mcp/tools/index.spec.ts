import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureTools } from ".";
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";

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