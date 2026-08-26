export interface OAuthDeterministic {
  nextAccessTokens?: string[];
  nextRefreshTokens?: string[];
  nextAuthorizationCodes?: string[];
  nextClientIds?: string[];
  nextClientSecrets?: string[];
}

export interface OAuthTokensConfig {
  expiresInSeconds?: number;
  refreshable?: boolean;
  rotateRefreshToken?: boolean;
  revoked?: string[];
  expired?: string[];
  deterministic?: OAuthDeterministic;
}

export interface OAuthSeedClient {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  scope?: string;
}

export interface OAuthMetadataConfig {
  resourceName?: string;
  scopesSupported?: string[];
  registrationEndpointEnabled?: boolean;
  issuerOverride?: string;
  resourcePath?: string;
  // Permit non-HTTPS, non-loopback issuer URLs (e.g. Kubernetes cluster DNS).
  // Test fixture only — must not be enabled in anything resembling production.
  allowInsecureIssuer?: boolean;
}

export interface OAuthConfig {
  protectedPaths: string[];
  clients?: OAuthSeedClient[];
  tokens?: OAuthTokensConfig;
  metadata?: OAuthMetadataConfig;
}

export type Clock = () => number;
