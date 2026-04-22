import express from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { Config } from '../config';
import { OAuthStore } from './store';
import { OAuthConfig } from './types';
import { createClientsStore } from './clients-store';
import { createProvider } from './provider';
import { createControlRouter } from './control';

export interface SetupOAuthOptions {
  host: string;
  port: number;
  clock?: () => number;
}

function resolveIssuer(initialOAuth: OAuthConfig | undefined, host: string, port: number): URL {
  if (initialOAuth?.metadata?.issuerOverride) {
    return new URL(initialOAuth.metadata.issuerOverride);
  }
  const safeHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  return new URL(`http://${safeHost}:${port}/`);
}

export function setupOAuth(
  app: express.Express,
  getConfig: () => Config,
  options: SetupOAuthOptions
): void {
  const clock = options.clock ?? (() => Date.now());
  const store = new OAuthStore(clock);
  const oauthGetter = (): OAuthConfig | undefined => getConfig().oauth;

  const clientsStore = createClientsStore(store, oauthGetter);
  const provider = createProvider(store, clientsStore, oauthGetter);

  const initialOAuth = getConfig().oauth;
  const issuerUrl = resolveIssuer(initialOAuth, options.host, options.port);
  const resourcePath = initialOAuth?.metadata?.resourcePath ?? '/mcp';
  const resourceServerUrl = new URL(resourcePath, issuerUrl);
  const scopesSupported = initialOAuth?.metadata?.scopesSupported ?? ['mcp:read', 'mcp:tools'];
  const resourceName = initialOAuth?.metadata?.resourceName ?? 'Mock MCP Resource';
  const resourceMetadataUrl = new URL(
    `/.well-known/oauth-protected-resource${resourcePath === '/' ? '' : resourcePath}`,
    issuerUrl
  ).href;

  // Mount SDK OAuth router (authorize, token, register, well-known). Rate limits disabled
  // for deterministic testing.
  app.use(mcpAuthRouter({
    provider,
    issuerUrl,
    resourceServerUrl,
    scopesSupported,
    resourceName,
    authorizationOptions: { rateLimit: false },
    tokenOptions: { rateLimit: false },
    clientRegistrationOptions: { rateLimit: false, clientIdGeneration: false }
  }));

  // Dynamic Bearer gate: only challenges when current config lists the path.
  const gate = requireBearerAuth({ verifier: provider, resourceMetadataUrl });
  app.use((req, res, next) => {
    const oauth = oauthGetter();
    if (!oauth || oauth.protectedPaths.length === 0) return next();
    const matched = oauth.protectedPaths.some(p => {
      try {
        return new RegExp(p).test(req.path);
      } catch {
        return false;
      }
    });
    if (!matched) return next();
    return gate(req, res, next);
  });

  // Fixture control endpoints.
  app.use('/oauth', createControlRouter(store, oauthGetter));
}
