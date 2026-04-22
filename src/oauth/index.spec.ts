import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createServer } from '../server';
import { Config, getDefaultConfig } from '../config';

const PROBE_INIT = JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'probe', version: '1.0.0' }
  },
  id: 1
});

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function withOAuth(patch: Partial<Config['oauth']>): Config {
  const cfg = getDefaultConfig() as Config;
  cfg.oauth = { protectedPaths: [], ...patch } as Config['oauth'];
  return cfg;
}

describe('oauth end-to-end', () => {
  const app = createServer(withOAuth({
    protectedPaths: ['/mcp'],
    tokens: {
      expiresInSeconds: 3600,
      refreshable: true,
      deterministic: {
        nextAccessTokens: ['fixture-access-001'],
        nextRefreshTokens: ['fixture-refresh-001'],
        nextAuthorizationCodes: ['fixture-code-001'],
        nextClientIds: ['fixture-client-001']
      }
    }
  }), 'localhost', 6556);
  let server: ReturnType<typeof app.listen>;
  let base: string;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      base = `http://localhost:${addr.port}`;
      done();
    });
  });
  afterAll((done) => { server.close(done); });

  describe('discovery', () => {
    it('serves RFC 8414 authorization server metadata', async () => {
      const res = await fetch(`${base}/.well-known/oauth-authorization-server`);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.issuer).toBeDefined();
      expect(body.authorization_endpoint).toMatch(/\/authorize$/);
      expect(body.token_endpoint).toMatch(/\/token$/);
      expect(body.registration_endpoint).toMatch(/\/register$/);
      expect(body.code_challenge_methods_supported).toEqual(['S256']);
      expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    });

    it('serves RFC 9728 protected resource metadata at the path-suffixed URL', async () => {
      const res = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.resource).toMatch(/\/mcp$/);
      expect(Array.isArray(body.authorization_servers)).toBe(true);
      expect(body.resource_name).toBe('Mock MCP Resource');
    });
  });

  describe('gate', () => {
    it('returns 401 with RFC 9728 WWW-Authenticate when no Bearer token is sent', async () => {
      const res = await fetch(`${base}/mcp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
        body: PROBE_INIT
      });
      expect(res.status).toBe(401);
      const wwwAuth = res.headers.get('www-authenticate');
      expect(wwwAuth).toContain('Bearer');
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('resource_metadata=');
    });

    it('returns 401 for a bogus Bearer token', async () => {
      const res = await fetch(`${base}/mcp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': 'Bearer nonsense'
        },
        body: PROBE_INIT
      });
      expect(res.status).toBe(401);
    });
  });

  describe('end-to-end PKCE flow', () => {
    it('DCR → authorize → token → authenticated MCP initialize', async () => {
      const redirectUri = 'http://127.0.0.1:39999/callback';

      // DCR
      const dcr = await fetch(`${base}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'test',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none'
        })
      });
      expect(dcr.status).toBe(201);
      const client = await dcr.json() as { client_id: string };
      expect(client.client_id).toBe('fixture-client-001');

      // PKCE
      const verifier = base64url(Buffer.from('test-verifier-abc123test-verifier-abc123'));
      const challenge = base64url(createHash('sha256').update(verifier).digest());

      // Authorize
      const authUrl = new URL(`${base}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', client.client_id);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', 'state-xyz');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      const authRes = await fetch(authUrl.href, { redirect: 'manual' });
      expect(authRes.status).toBe(302);
      const location = authRes.headers.get('location')!;
      const redirected = new URL(location);
      expect(redirected.searchParams.get('code')).toBe('fixture-code-001');
      expect(redirected.searchParams.get('state')).toBe('state-xyz');

      // Token exchange
      const tokenBody = new URLSearchParams();
      tokenBody.set('grant_type', 'authorization_code');
      tokenBody.set('code', 'fixture-code-001');
      tokenBody.set('redirect_uri', redirectUri);
      tokenBody.set('client_id', client.client_id);
      tokenBody.set('code_verifier', verifier);
      const tokenRes = await fetch(`${base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString()
      });
      expect(tokenRes.status).toBe(200);
      const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; token_type: string; expires_in: number };
      expect(tokens.access_token).toBe('fixture-access-001');
      expect(tokens.refresh_token).toBe('fixture-refresh-001');
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBe(3600);

      // Replayed code is rejected
      const replay = await fetch(`${base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString()
      });
      expect(replay.status).toBe(400);

      // Authenticated MCP initialize
      const mcpRes = await fetch(`${base}/mcp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${tokens.access_token}`
        },
        body: PROBE_INIT
      });
      expect(mcpRes.status).toBe(200);
    });

    it('rejects /token with a mismatched PKCE verifier', async () => {
      const redirectUri = 'http://127.0.0.1:39998/callback';

      const dcr = await fetch(`${base}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'bad',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none'
        })
      });
      const client = await dcr.json() as { client_id: string };

      const verifier = 'real-verifier-0000000000000000000000000000';
      const challenge = base64url(createHash('sha256').update(verifier).digest());

      const authUrl = new URL(`${base}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', client.client_id);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      const authRes = await fetch(authUrl.href, { redirect: 'manual' });
      const code = new URL(authRes.headers.get('location')!).searchParams.get('code')!;

      const tokenBody = new URLSearchParams();
      tokenBody.set('grant_type', 'authorization_code');
      tokenBody.set('code', code);
      tokenBody.set('redirect_uri', redirectUri);
      tokenBody.set('client_id', client.client_id);
      tokenBody.set('code_verifier', 'wrong-verifier-11111111111111111111111111');
      const res = await fetch(`${base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString()
      });
      expect(res.status).toBe(400);
      const err = await res.json() as { error: string };
      expect(err.error).toBe('invalid_grant');
    });
  });

  describe('setup options', () => {
    it('honours metadata.issuerOverride and survives bad regex in protectedPaths', async () => {
      const cfg: Config = withOAuth({
        protectedPaths: ['/mcp', '[invalid(regex'],
        metadata: { issuerOverride: 'http://127.0.0.1:6556/' }
      });
      const altApp = createServer(cfg, 'localhost', 6556);
      const altServer = altApp.listen(0);
      const { port } = altServer.address() as { port: number };
      try {
        const meta = await fetch(`http://localhost:${port}/.well-known/oauth-authorization-server`)
          .then(r => r.json() as Promise<Record<string, unknown>>);
        expect(meta.issuer).toBe('http://127.0.0.1:6556/');

        // Request an unprotected, unmatched path — the bad-regex entry must not throw.
        const unprotected = await fetch(`http://localhost:${port}/health`);
        expect(unprotected.status).toBe(200);
      } finally {
        altServer.close();
      }
    });
  });

  describe('refresh grant', () => {
    it('refresh issues a new access token and keeps original refresh_token when rotation is off', async () => {
      const cfg: Config = withOAuth({
        protectedPaths: ['/mcp'],
        clients: [{ clientId: 'ref-client', redirectUris: ['http://x'] }],
        tokens: {
          expiresInSeconds: 60,
          refreshable: true,
          deterministic: {
            nextAccessTokens: ['acc-a', 'acc-b'],
            nextRefreshTokens: ['ref-a']
          }
        }
      });
      await fetch(`${base}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      await fetch(`${base}/oauth/reset`, { method: 'POST' });

      const issued = await fetch(`${base}/oauth/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'ref-client' })
      }).then(r => r.json() as Promise<{ access_token: string; refresh_token: string }>);

      const body = new URLSearchParams();
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', issued.refresh_token);
      body.set('client_id', 'ref-client');
      const res = await fetch(`${base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      expect(res.status).toBe(200);
      const refreshed = await res.json() as { access_token: string; refresh_token: string };
      expect(refreshed.access_token).toBe('acc-b');
      expect(refreshed.refresh_token).toBe(issued.refresh_token);
    });
  });
});
