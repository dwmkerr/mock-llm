import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { configureTools } from ".";
import { setCurrentRequestHeaders } from '../request-context';

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

  it('echo_headers tool should be in tools/list', async () => {
    const client = await getMcpServerClientStub();

    const response = await client.request(
      {
        method: 'tools/list',
      },
      ListToolsResultSchema
    );

    expect(response.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'echo_headers',
          description: 'returns HTTP headers as JSON',
        })
      ])
    );
  });

  it('echo_headers tool should return request headers as JSON', async () => {
    const client = await getMcpServerClientStub();

    // Set mock headers
    setCurrentRequestHeaders({
      'authorization': 'Bearer test-token-123',
      'x-custom-header': 'test-value',
      'content-type': 'application/json'
    });

    const response = await client.request({
      method: 'tools/call',
      params: {
        name: 'echo_headers',
        arguments: {}
      }
    }, CallToolResultSchema);

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');

    const headers = JSON.parse(response.content[0].text as string);
    expect(headers).toEqual({
      'authorization': 'Bearer test-token-123',
      'x-custom-header': 'test-value',
      'content-type': 'application/json'
    });
  });

  it('echo_headers tool should return empty object when no headers set', async () => {
    const client = await getMcpServerClientStub();

    // Clear headers
    setCurrentRequestHeaders({});

    const response = await client.request({
      method: 'tools/call',
      params: {
        name: 'echo_headers',
        arguments: {}
      }
    }, CallToolResultSchema);

    expect(response.content).toHaveLength(1);
    const headers = JSON.parse(response.content[0].text as string);
    expect(headers).toEqual({});
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