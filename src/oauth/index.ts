import express from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthMetadata, OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
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

// Build RFC 8414 authorization server metadata matching the SDK's
// createOAuthMetadata output shape. Kept in sync with the SDK by structural
// parity tests in index.spec.ts.
function buildAuthorizationServerMetadata(
  issuerUrl: URL,
  provider: OAuthServerProvider,
  scopesSupported: string[]
): OAuthMetadata {
  const registrationEnabled = Boolean(provider.clientsStore.registerClient);
  return {
    issuer: issuerUrl.href,
    authorization_endpoint: new URL('/authorize', issuerUrl).href,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint: new URL('/token', issuerUrl).href,
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    scopes_supported: scopesSupported,
    registration_endpoint: registrationEnabled ? new URL('/register', issuerUrl).href : undefined
  };
}

function mountInsecureOAuthRouter(
  app: express.Express,
  provider: OAuthServerProvider,
  issuerUrl: URL,
  resourceServerUrl: URL,
  scopesSupported: string[],
  resourceName: string
): void {
  const authorizationServerMetadata = buildAuthorizationServerMetadata(
    issuerUrl,
    provider,
    scopesSupported
  );
  const protectedResourceMetadata: OAuthProtectedResourceMetadata = {
    resource: resourceServerUrl.href,
    authorization_servers: [authorizationServerMetadata.issuer],
    scopes_supported: scopesSupported,
    resource_name: resourceName
  };

  const rsPath = new URL(resourceServerUrl.href).pathname;
  app.use(
    `/.well-known/oauth-protected-resource${rsPath === '/' ? '' : rsPath}`,
    metadataHandler(protectedResourceMetadata)
  );
  app.use('/.well-known/oauth-authorization-server', metadataHandler(authorizationServerMetadata));

  app.use('/authorize', authorizationHandler({ provider, rateLimit: false }));
  app.use('/token', tokenHandler({ provider, rateLimit: false }));
  if (authorizationServerMetadata.registration_endpoint) {
    app.use(
      '/register',
      clientRegistrationHandler({
        clientsStore: provider.clientsStore,
        rateLimit: false,
        clientIdGeneration: false
      })
    );
  }
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

  // The SDK's mcpAuthRouter rejects non-HTTPS, non-loopback issuers at boot.
  // Kubernetes cluster DNS (e.g. http://mock-llm.ns.svc.cluster.local:6556) is
  // neither, so when the fixture opts in we mount the SDK's exported handlers
  // directly with metadata we build ourselves.
  if (initialOAuth?.metadata?.allowInsecureIssuer) {
    mountInsecureOAuthRouter(app, provider, issuerUrl, resourceServerUrl, scopesSupported, resourceName);
  } else {
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
  }

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
