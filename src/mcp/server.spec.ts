import { getStreamableHTTPRouter } from './http-server';
import { getMCPServer } from './server';

describe('MCP Server', () => {
  it('should expose MCP server routes', async () => {
    const router = getStreamableHTTPRouter();
    expect(router).toBeDefined();

    expect(router.stack).toEqual(
      expect.arrayContaining([
        // post route
        expect.objectContaining({ route: expect.objectContaining({ path: '/', methods: expect.objectContaining({ post: true }) }) }),
        // get route
        expect.objectContaining({ route: expect.objectContaining({ path: '/', methods: expect.objectContaining({ get: true }) }) }),
        // delete route
        expect.objectContaining({ route: expect.objectContaining({ path: '/', methods: expect.objectContaining({ delete: true }) }) }),
      ])
    );
  });

  it('should create MCP server instance', () => {
    const serverInfo = getMCPServer();
    expect(serverInfo).toMatchObject({
      name: 'echo-mcp',
      tools: expect.arrayContaining([
        expect.objectContaining({ name: 'echo' }),
        expect.objectContaining({ name: 'echo_headers' }),
      ]),
    });
    expect(serverInfo.server.constructor.name).toBe('McpServer');
  });
});
