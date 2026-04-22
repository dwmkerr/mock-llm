import type { Response } from 'express';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthStore } from './store';
import { OAuthConfig } from './types';

export function createClientsStore(
  store: OAuthStore,
  getConfig: () => OAuthConfig | undefined
): OAuthRegisteredClientsStore {
  return {
    getClient(clientId: string): OAuthClientInformationFull | undefined {
      const config = getConfig();
      if (!config) return undefined;
      return store.getClient(config, clientId);
    },
    registerClient(input): OAuthClientInformationFull {
      const config = getConfig();
      if (!config) {
        throw new Error('OAuth not configured');
      }
      return store.registerClient(config, input);
    }
  };
}

export { Response };
