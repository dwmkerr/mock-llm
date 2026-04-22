import { describe, it, expect, beforeEach } from '@jest/globals';
import { OAuthStore } from './store';
import { OAuthConfig } from './types';

describe('OAuthStore', () => {
  let now = 1_700_000_000_000;
  const clock = () => now;
  let store: OAuthStore;
  const baseConfig: OAuthConfig = {
    protectedPaths: ['/mcp'],
    tokens: { expiresInSeconds: 100, refreshable: true }
  };

  beforeEach(() => {
    now = 1_700_000_000_000;
    store = new OAuthStore(clock);
  });

  describe('deterministic issuance', () => {
    it('consumes deterministic access+refresh tokens in order, falls back to random', () => {
      const config: OAuthConfig = {
        ...baseConfig,
        tokens: {
          expiresInSeconds: 100, refreshable: true,
          deterministic: { nextAccessTokens: ['a1', 'a2'], nextRefreshTokens: ['r1'] }
        }
      };
      const t1 = store.issueToken(config, 'c', ['mcp:read']);
      const t2 = store.issueToken(config, 'c', ['mcp:read']);
      const t3 = store.issueToken(config, 'c', ['mcp:read']);
      expect(t1.accessToken).toBe('a1');
      expect(t1.refreshToken).toBe('r1');
      expect(t2.accessToken).toBe('a2');
      expect(t2.refreshToken).toMatch(/^[a-f0-9]{32}$/);
      expect(t3.accessToken).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('validation', () => {
    it('valid for freshly issued token', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      expect(store.isValid(baseConfig, t.accessToken)).toBe(true);
    });

    it('invalid after clock advances past expiresAt', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      now += 101_000;
      expect(store.isValid(baseConfig, t.accessToken)).toBe(false);
    });

    it('invalid when listed in config.tokens.revoked', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      const cfg: OAuthConfig = { ...baseConfig, tokens: { ...baseConfig.tokens, revoked: [t.accessToken] } };
      expect(store.isValid(cfg, t.accessToken)).toBe(false);
    });

    it('invalid when listed in config.tokens.expired', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      const cfg: OAuthConfig = { ...baseConfig, tokens: { ...baseConfig.tokens, expired: [t.accessToken] } };
      expect(store.isValid(cfg, t.accessToken)).toBe(false);
    });

    it('invalid for unknown token', () => {
      expect(store.isValid(baseConfig, 'nope')).toBe(false);
    });
  });

  describe('refresh', () => {
    it('issues new access token and keeps same refresh_token when rotation off', () => {
      const t1 = store.issueToken(baseConfig, 'c', ['s']);
      const t2 = store.refreshToken(baseConfig, t1.refreshToken!);
      expect(t2).toBeDefined();
      expect(t2!.refreshToken).toBe(t1.refreshToken);
      expect(t2!.accessToken).not.toBe(t1.accessToken);
      expect(store.isValid(baseConfig, t1.accessToken)).toBe(false);
      expect(store.isValid(baseConfig, t2!.accessToken)).toBe(true);
    });

    it('rotates refresh_token when rotateRefreshToken=true and invalidates old one', () => {
      const cfg: OAuthConfig = { ...baseConfig, tokens: { ...baseConfig.tokens, rotateRefreshToken: true } };
      const t1 = store.issueToken(cfg, 'c', ['s']);
      const t2 = store.refreshToken(cfg, t1.refreshToken!);
      expect(t2!.refreshToken).not.toBe(t1.refreshToken);
      expect(store.refreshToken(cfg, t1.refreshToken!)).toBeUndefined();
    });

    it('returns undefined for unknown refresh_token', () => {
      expect(store.refreshToken(baseConfig, 'nope')).toBeUndefined();
    });
  });

  describe('authorization codes', () => {
    it('issues and consumes code once', () => {
      const c = store.issueAuthCode(baseConfig, {
        clientId: 'c', redirectUri: 'http://x', codeChallenge: 'cc', scopes: ['s']
      });
      expect(store.consumeAuthCode(c.code)).toBeDefined();
      expect(store.consumeAuthCode(c.code)).toBeUndefined();
    });

    it('returns undefined once code is past TTL', () => {
      const c = store.issueAuthCode(baseConfig, {
        clientId: 'c', redirectUri: 'http://x', codeChallenge: 'cc', scopes: ['s']
      });
      now += 11 * 60 * 1000;
      expect(store.consumeAuthCode(c.code)).toBeUndefined();
    });

    it('getAuthCode does not consume the code', () => {
      const c = store.issueAuthCode(baseConfig, {
        clientId: 'c', redirectUri: 'http://x', codeChallenge: 'cc', scopes: ['s']
      });
      expect(store.getAuthCode(c.code)).toBeDefined();
      expect(store.getAuthCode(c.code)).toBeDefined();
      expect(store.consumeAuthCode(c.code)).toBeDefined();
      expect(store.getAuthCode(c.code)).toBeUndefined();
    });
  });

  describe('control ops', () => {
    it('revoke by access_token kills both sides', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      store.revoke(t.accessToken);
      expect(store.isValid(baseConfig, t.accessToken)).toBe(false);
      expect(store.refreshToken(baseConfig, t.refreshToken!)).toBeUndefined();
    });

    it('revoke by refresh_token kills both sides', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      store.revoke(t.refreshToken!);
      expect(store.isValid(baseConfig, t.accessToken)).toBe(false);
      expect(store.refreshToken(baseConfig, t.refreshToken!)).toBeUndefined();
    });

    it('forceExpire flips valid to invalid', () => {
      const t = store.issueToken(baseConfig, 'c', ['s']);
      store.forceExpire(t.accessToken);
      expect(store.isValid(baseConfig, t.accessToken)).toBe(false);
    });

    it('reset wipes everything including deterministic indices', () => {
      const cfg: OAuthConfig = {
        ...baseConfig,
        tokens: {
          expiresInSeconds: 100, refreshable: true,
          deterministic: { nextAccessTokens: ['a1', 'a2'] }
        }
      };
      store.issueToken(cfg, 'c', ['s']);
      store.reset();
      const t = store.issueToken(cfg, 'c', ['s']);
      expect(t.accessToken).toBe('a1');
    });
  });

  describe('clients', () => {
    it('getClient finds seeded clients', () => {
      const cfg: OAuthConfig = {
        ...baseConfig,
        clients: [{ clientId: 'seed', redirectUris: ['http://x'], scope: 'mcp:read' }]
      };
      const c = store.getClient(cfg, 'seed');
      expect(c?.client_id).toBe('seed');
      expect(c?.redirect_uris).toEqual(['http://x']);
      expect(c?.token_endpoint_auth_method).toBe('none');
    });

    it('registers public client without secret', () => {
      const c = store.registerClient(baseConfig, {
        redirect_uris: ['http://127.0.0.1:39999/callback'],
        token_endpoint_auth_method: 'none'
      });
      expect(c.client_id).toBeDefined();
      expect(c.client_secret).toBeUndefined();
    });

    it('registers confidential client with secret', () => {
      const c = store.registerClient(baseConfig, {
        redirect_uris: ['http://x'],
        token_endpoint_auth_method: 'client_secret_post'
      });
      expect(c.client_secret).toBeDefined();
    });

    it('uses deterministic client_id and client_secret when configured', () => {
      const cfg: OAuthConfig = {
        ...baseConfig,
        tokens: {
          expiresInSeconds: 100, refreshable: true,
          deterministic: { nextClientIds: ['cid-1'], nextClientSecrets: ['sec-1'] }
        }
      };
      const c = store.registerClient(cfg, {
        redirect_uris: ['http://x'],
        token_endpoint_auth_method: 'client_secret_post'
      });
      expect(c.client_id).toBe('cid-1');
      expect(c.client_secret).toBe('sec-1');
    });
  });
});
