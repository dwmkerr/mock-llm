import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Response } from 'express';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  InvalidGrantError,
  InvalidTokenError,
  ServerError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { OAuthStore } from './store';
import { createClientsStore } from './clients-store';
import { createProvider } from './provider';
import { OAuthConfig } from './types';

describe('OAuthServerProvider', () => {
  const now = 1_700_000_000_000;
  const clock = () => now;
  let store: OAuthStore;
  let config: OAuthConfig | undefined;
  const getConfig = () => config;
  const baseConfig: OAuthConfig = {
    protectedPaths: ['/mcp'],
    tokens: { expiresInSeconds: 100, refreshable: true }
  };

  const client = (clientId = 'c1'): OAuthClientInformationFull => ({
    client_id: clientId,
    redirect_uris: ['http://127.0.0.1:39999/callback'],
    token_endpoint_auth_method: 'none'
  });

  const mockRes = (): { res: Response; redirect: jest.Mock } => {
    const redirect = jest.fn();
    return { res: { redirect } as unknown as Response, redirect };
  };

  beforeEach(() => {
    store = new OAuthStore(clock);
    config = baseConfig;
  });

  const provider = () => createProvider(store, createClientsStore(store, getConfig), getConfig);

  describe('requireConfig', () => {
    it('verifyAccessToken throws ServerError when oauth config is missing', async () => {
      config = undefined;
      await expect(provider().verifyAccessToken('any')).rejects.toBeInstanceOf(ServerError);
    });
  });

  describe('authorize', () => {
    it('issues a code and redirects with code+state', async () => {
      const { res, redirect } = mockRes();
      await provider().authorize(client(), {
        state: 'S1',
        scopes: ['mcp:read'],
        redirectUri: 'http://127.0.0.1:39999/callback',
        codeChallenge: 'cc'
      }, res);
      expect(redirect).toHaveBeenCalledTimes(1);
      const [status, url] = redirect.mock.calls[0];
      expect(status).toBe(302);
      const parsed = new URL(url as string);
      expect(parsed.searchParams.get('code')).toMatch(/.+/);
      expect(parsed.searchParams.get('state')).toBe('S1');
    });

    it('omits state when not provided', async () => {
      const { res, redirect } = mockRes();
      await provider().authorize(client(), {
        scopes: [],
        redirectUri: 'http://127.0.0.1:39999/callback',
        codeChallenge: 'cc'
      }, res);
      const [, url] = redirect.mock.calls[0];
      expect(new URL(url as string).searchParams.get('state')).toBeNull();
    });
  });

  describe('challengeForAuthorizationCode', () => {
    it('returns stored challenge', async () => {
      const code = store.issueAuthCode(baseConfig, {
        clientId: 'c1', redirectUri: 'http://x', codeChallenge: 'CC', scopes: []
      });
      await expect(provider().challengeForAuthorizationCode(client(), code.code)).resolves.toBe('CC');
    });

    it('throws InvalidGrantError for unknown code', async () => {
      await expect(provider().challengeForAuthorizationCode(client(), 'nope'))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('throws InvalidGrantError when code was issued to a different client', async () => {
      const code = store.issueAuthCode(baseConfig, {
        clientId: 'other', redirectUri: 'http://x', codeChallenge: 'CC', scopes: []
      });
      await expect(provider().challengeForAuthorizationCode(client('c1'), code.code))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('issues tokens when code, client, and redirect_uri match', async () => {
      const code = store.issueAuthCode(baseConfig, {
        clientId: 'c1', redirectUri: 'http://127.0.0.1:39999/callback', codeChallenge: 'CC', scopes: ['mcp:read']
      });
      const tokens = await provider().exchangeAuthorizationCode(
        client('c1'), code.code, undefined, 'http://127.0.0.1:39999/callback'
      );
      expect(tokens.access_token).toMatch(/.+/);
      expect(tokens.scope).toBe('mcp:read');
    });

    it('rejects unknown or expired codes', async () => {
      await expect(provider().exchangeAuthorizationCode(client(), 'nope', undefined, undefined))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('rejects code issued to a different client', async () => {
      const code = store.issueAuthCode(baseConfig, {
        clientId: 'other', redirectUri: 'http://x', codeChallenge: 'CC', scopes: []
      });
      await expect(provider().exchangeAuthorizationCode(client('c1'), code.code, undefined, undefined))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('rejects mismatched redirect_uri', async () => {
      const code = store.issueAuthCode(baseConfig, {
        clientId: 'c1', redirectUri: 'http://a/callback', codeChallenge: 'CC', scopes: []
      });
      await expect(provider().exchangeAuthorizationCode(
        client('c1'), code.code, undefined, 'http://b/callback'
      )).rejects.toBeInstanceOf(InvalidGrantError);
    });
  });

  describe('exchangeRefreshToken', () => {
    it('rejects when refreshable=false', async () => {
      config = { ...baseConfig, tokens: { ...baseConfig.tokens, refreshable: false } };
      await expect(provider().exchangeRefreshToken(client(), 'any'))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('rejects unknown refresh_token', async () => {
      await expect(provider().exchangeRefreshToken(client(), 'nope'))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('rejects refresh_token issued to a different client', async () => {
      const issued = store.issueToken(baseConfig, 'other', ['s']);
      await expect(provider().exchangeRefreshToken(client('c1'), issued.refreshToken!))
        .rejects.toBeInstanceOf(InvalidGrantError);
    });

    it('issues new access token on happy path', async () => {
      const issued = store.issueToken(baseConfig, 'c1', ['s']);
      const tokens = await provider().exchangeRefreshToken(client('c1'), issued.refreshToken!);
      expect(tokens.access_token).not.toBe(issued.accessToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns AuthInfo with expiresAt in seconds for a valid token', async () => {
      const issued = store.issueToken(baseConfig, 'c1', ['mcp:read']);
      const info = await provider().verifyAccessToken(issued.accessToken);
      expect(info.token).toBe(issued.accessToken);
      expect(info.clientId).toBe('c1');
      expect(info.scopes).toEqual(['mcp:read']);
      expect(info.expiresAt).toBe(Math.floor(issued.expiresAt / 1000));
    });

    it('throws InvalidTokenError for unknown token', async () => {
      await expect(provider().verifyAccessToken('nope')).rejects.toBeInstanceOf(InvalidTokenError);
    });
  });
});
