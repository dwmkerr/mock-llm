import { getMcpRouter } from './http-server';
import { getMCPServer } from './server';

describe('MCP Server', () => {
  it('should expose MCP server routes', async () => {
    const router = getMcpRouter();
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
    const server = getMCPServer();
    expect(server).toBeDefined();
    expect(server.constructor.name).toBe('McpServer');
  });
});
