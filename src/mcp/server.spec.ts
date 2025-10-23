import { getMcpRouter } from './http-server';

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
  })
});


