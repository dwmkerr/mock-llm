import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { OAuthStore } from './store';
import { createControlRouter } from './control';
import { OAuthConfig } from './types';

describe('control endpoints', () => {
  const now = 1_700_000_000_000;
  const clock = () => now;
  const store = new OAuthStore(clock);
  const config: OAuthConfig = { protectedPaths: ['/mcp'], tokens: { expiresInSeconds: 100, refreshable: true } };

  const app = express();
  app.use('/oauth', createControlRouter(store, () => config));
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

  describe('POST /oauth/issue', () => {
    it('mints a usable token for a given clientId', async () => {
      const res = await fetch(`${base}/oauth/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'cx', scope: 'mcp:read' })
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { access_token: string; token_type: string; expires_in: number; scope: string };
      expect(body.access_token).toBeDefined();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBe(100);
      expect(body.scope).toBe('mcp:read');
      expect(store.isValid(config, body.access_token)).toBe(true);
    });

    it('rejects missing clientId', async () => {
      const res = await fetch(`${base}/oauth/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /oauth/revoke', () => {
    it('invalidates issued token', async () => {
      const issued = store.issueToken(config, 'cx', ['s']);
      const res = await fetch(`${base}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: issued.accessToken })
      });
      expect(res.status).toBe(204);
      expect(store.isValid(config, issued.accessToken)).toBe(false);
    });

    it('accepts refresh_token field as alternative', async () => {
      const issued = store.issueToken(config, 'cx', ['s']);
      const res = await fetch(`${base}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: issued.refreshToken })
      });
      expect(res.status).toBe(204);
      expect(store.isValid(config, issued.accessToken)).toBe(false);
    });

    it('rejects empty body', async () => {
      const res = await fetch(`${base}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /oauth/expire', () => {
    it('forces a valid token to become invalid', async () => {
      const issued = store.issueToken(config, 'cx', ['s']);
      const res = await fetch(`${base}/oauth/expire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: issued.accessToken })
      });
      expect(res.status).toBe(204);
      expect(store.isValid(config, issued.accessToken)).toBe(false);
    });
  });

  describe('POST /oauth/reset', () => {
    it('wipes all issued tokens', async () => {
      const issued = store.issueToken(config, 'cx', ['s']);
      const res = await fetch(`${base}/oauth/reset`, { method: 'POST' });
      expect(res.status).toBe(204);
      expect(store.isValid(config, issued.accessToken)).toBe(false);
    });
  });
});
