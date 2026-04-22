import { randomBytes } from 'node:crypto';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Clock, OAuthConfig } from './types';

const DEFAULT_EXPIRES_IN = 3600;
const CODE_TTL_MS = 10 * 60 * 1000;

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
}

export interface StoredAuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  expiresAt: number;
}

type DeterministicIndex =
  | 'accessIdx'
  | 'refreshIdx'
  | 'codeIdx'
  | 'clientIdIdx'
  | 'clientSecretIdx';

export class OAuthStore {
  private tokens: Map<string, StoredToken> = new Map();
  private refreshIndex: Map<string, string> = new Map();
  private codes: Map<string, StoredAuthCode> = new Map();
  private dynamicClients: Map<string, OAuthClientInformationFull> = new Map();

  private accessIdx = 0;
  private refreshIdx = 0;
  private codeIdx = 0;
  private clientIdIdx = 0;
  private clientSecretIdx = 0;

  constructor(private clock: Clock) {}

  private nextDeterministic(queue: string[] | undefined, idxKey: DeterministicIndex): string | undefined {
    if (!queue) return undefined;
    const i = this[idxKey];
    if (i >= queue.length) return undefined;
    this[idxKey] = i + 1;
    return queue[i];
  }

  private randomId(): string {
    return randomBytes(16).toString('hex');
  }

  getClient(config: OAuthConfig, clientId: string): OAuthClientInformationFull | undefined {
    const seeded = config.clients?.find(c => c.clientId === clientId);
    if (seeded) {
      return {
        client_id: seeded.clientId,
        client_secret: seeded.clientSecret,
        redirect_uris: seeded.redirectUris,
        scope: seeded.scope,
        token_endpoint_auth_method: seeded.clientSecret ? 'client_secret_post' : 'none'
      };
    }
    return this.dynamicClients.get(clientId);
  }

  registerClient(
    config: OAuthConfig,
    input: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>
  ): OAuthClientInformationFull {
    const isPublic = input.token_endpoint_auth_method === 'none';
    const clientId = this.nextDeterministic(config.tokens?.deterministic?.nextClientIds, 'clientIdIdx') ?? this.randomId();
    const clientSecret = isPublic
      ? undefined
      : (input.client_secret ?? this.nextDeterministic(config.tokens?.deterministic?.nextClientSecrets, 'clientSecretIdx') ?? this.randomId());

    const info: OAuthClientInformationFull = {
      ...input,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(this.clock() / 1000),
      client_secret_expires_at: isPublic ? undefined : 0
    };
    this.dynamicClients.set(clientId, info);
    return info;
  }

  issueAuthCode(
    config: OAuthConfig,
    params: { clientId: string; redirectUri: string; codeChallenge: string; scopes: string[] }
  ): StoredAuthCode {
    const code = this.nextDeterministic(config.tokens?.deterministic?.nextAuthorizationCodes, 'codeIdx') ?? this.randomId();
    const entry: StoredAuthCode = {
      code,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes,
      expiresAt: this.clock() + CODE_TTL_MS
    };
    this.codes.set(code, entry);
    return entry;
  }

  getAuthCode(code: string): StoredAuthCode | undefined {
    this.evictExpiredCodes();
    return this.codes.get(code);
  }

  consumeAuthCode(code: string): StoredAuthCode | undefined {
    this.evictExpiredCodes();
    const entry = this.codes.get(code);
    if (!entry) return undefined;
    this.codes.delete(code);
    if (entry.expiresAt < this.clock()) return undefined;
    return entry;
  }

  private evictExpiredCodes(): void {
    const now = this.clock();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt < now) {
        this.codes.delete(code);
      }
    }
  }

  issueToken(config: OAuthConfig, clientId: string, scopes: string[]): StoredToken {
    const expiresIn = config.tokens?.expiresInSeconds ?? DEFAULT_EXPIRES_IN;
    const refreshable = config.tokens?.refreshable ?? true;
    const accessToken = this.nextDeterministic(config.tokens?.deterministic?.nextAccessTokens, 'accessIdx') ?? this.randomId();
    const refreshToken = refreshable
      ? (this.nextDeterministic(config.tokens?.deterministic?.nextRefreshTokens, 'refreshIdx') ?? this.randomId())
      : undefined;
    const now = this.clock();
    const token: StoredToken = {
      accessToken,
      refreshToken,
      clientId,
      scopes,
      issuedAt: now,
      expiresAt: now + expiresIn * 1000
    };
    this.tokens.set(accessToken, token);
    if (refreshToken) {
      this.refreshIndex.set(refreshToken, accessToken);
    }
    return token;
  }

  refreshToken(config: OAuthConfig, refreshToken: string): StoredToken | undefined {
    const accessToken = this.refreshIndex.get(refreshToken);
    if (!accessToken) return undefined;
    const existing = this.tokens.get(accessToken);
    if (!existing) {
      this.refreshIndex.delete(refreshToken);
      return undefined;
    }

    const rotate = config.tokens?.rotateRefreshToken ?? false;

    this.tokens.delete(existing.accessToken);
    if (rotate) {
      this.refreshIndex.delete(refreshToken);
    }

    const next = this.issueToken(config, existing.clientId, existing.scopes);

    if (!rotate && next.refreshToken) {
      this.refreshIndex.delete(next.refreshToken);
      this.tokens.delete(next.accessToken);
      const reused: StoredToken = { ...next, refreshToken };
      this.tokens.set(reused.accessToken, reused);
      this.refreshIndex.set(refreshToken, reused.accessToken);
      return reused;
    }
    return next;
  }

  getToken(accessToken: string): StoredToken | undefined {
    return this.tokens.get(accessToken);
  }

  isValid(config: OAuthConfig, accessToken: string): boolean {
    const t = this.tokens.get(accessToken);
    if (!t) return false;
    if (config.tokens?.revoked?.includes(accessToken)) return false;
    if (config.tokens?.expired?.includes(accessToken)) return false;
    if (t.expiresAt < this.clock()) return false;
    return true;
  }

  revoke(tokenValue: string): void {
    if (this.tokens.has(tokenValue)) {
      const t = this.tokens.get(tokenValue)!;
      this.tokens.delete(tokenValue);
      if (t.refreshToken) this.refreshIndex.delete(t.refreshToken);
      return;
    }
    const access = this.refreshIndex.get(tokenValue);
    if (access) {
      this.refreshIndex.delete(tokenValue);
      this.tokens.delete(access);
    }
  }

  forceExpire(accessToken: string): void {
    const t = this.tokens.get(accessToken);
    if (!t) return;
    t.expiresAt = this.clock() - 1;
  }

  reset(): void {
    this.tokens.clear();
    this.refreshIndex.clear();
    this.codes.clear();
    this.dynamicClients.clear();
    this.accessIdx = 0;
    this.refreshIdx = 0;
    this.codeIdx = 0;
    this.clientIdIdx = 0;
    this.clientSecretIdx = 0;
  }
}
