import type { Response } from 'express';
import type {
  OAuthServerProvider,
  AuthorizationParams
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidGrantError,
  InvalidTokenError,
  ServerError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { OAuthStore } from './store';
import { OAuthConfig } from './types';

export function createProvider(
  store: OAuthStore,
  clientsStore: OAuthRegisteredClientsStore,
  getConfig: () => OAuthConfig | undefined
): OAuthServerProvider {
  const requireConfig = (): OAuthConfig => {
    const c = getConfig();
    if (!c) {
      throw new ServerError('OAuth not configured');
    }
    return c;
  };

  const toTokens = (t: { accessToken: string; refreshToken?: string; scopes: string[]; expiresAt: number; issuedAt: number }): OAuthTokens => ({
    access_token: t.accessToken,
    token_type: 'Bearer',
    expires_in: Math.max(0, Math.floor((t.expiresAt - t.issuedAt) / 1000)),
    refresh_token: t.refreshToken,
    scope: t.scopes.join(' ') || undefined
  });

  return {
    get clientsStore() { return clientsStore; },

    async authorize(
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      res: Response
    ): Promise<void> {
      const config = requireConfig();
      const entry = store.issueAuthCode(config, {
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        scopes: params.scopes ?? []
      });
      const redirect = new URL(params.redirectUri);
      redirect.searchParams.set('code', entry.code);
      if (params.state) {
        redirect.searchParams.set('state', params.state);
      }
      res.redirect(302, redirect.href);
    },

    async challengeForAuthorizationCode(
      client: OAuthClientInformationFull,
      authorizationCode: string
    ): Promise<string> {
      const entry = store.getAuthCode(authorizationCode);
      if (!entry || entry.clientId !== client.client_id) {
        throw new InvalidGrantError('Unknown or mismatched authorization code');
      }
      return entry.codeChallenge;
    },

    async exchangeAuthorizationCode(
      client: OAuthClientInformationFull,
      authorizationCode: string,
      _codeVerifier: string | undefined,
      redirectUri: string | undefined
    ): Promise<OAuthTokens> {
      const config = requireConfig();
      const entry = store.consumeAuthCode(authorizationCode);
      if (!entry) {
        throw new InvalidGrantError('Authorization code is invalid or expired');
      }
      if (entry.clientId !== client.client_id) {
        throw new InvalidGrantError('Authorization code was issued to a different client');
      }
      if (redirectUri !== undefined && redirectUri !== entry.redirectUri) {
        throw new InvalidGrantError('redirect_uri does not match the original request');
      }
      const issued = store.issueToken(config, client.client_id, entry.scopes);
      return toTokens(issued);
    },

    async exchangeRefreshToken(
      client: OAuthClientInformationFull,
      refreshToken: string
    ): Promise<OAuthTokens> {
      const config = requireConfig();
      if (config.tokens?.refreshable === false) {
        throw new InvalidGrantError('Refresh tokens are disabled');
      }
      const issued = store.refreshToken(config, refreshToken);
      if (!issued) {
        throw new InvalidGrantError('Refresh token is invalid or expired');
      }
      if (issued.clientId !== client.client_id) {
        throw new InvalidGrantError('Refresh token was issued to a different client');
      }
      return toTokens(issued);
    },

    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const config = requireConfig();
      if (!store.isValid(config, token)) {
        throw new InvalidTokenError('Token is invalid, revoked, or expired');
      }
      const stored = store.getToken(token)!;
      return {
        token,
        clientId: stored.clientId,
        scopes: stored.scopes,
        expiresAt: Math.floor(stored.expiresAt / 1000)
      };
    }
  };
}
