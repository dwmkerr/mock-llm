import { describe, it, expect } from '@jest/globals';
import { OAuthStore } from './store';
import { createClientsStore } from './clients-store';
import { OAuthConfig } from './types';

describe('clientsStore', () => {
  const clock = () => 1_700_000_000_000;
  const config: OAuthConfig = {
    protectedPaths: ['/mcp'],
    clients: [{ clientId: 'seed', redirectUris: ['http://x'] }]
  };

  it('getClient returns seeded client', async () => {
    const store = new OAuthStore(clock);
    const cs = createClientsStore(store, () => config);
    const c = await cs.getClient('seed');
    expect(c?.client_id).toBe('seed');
  });

  it('getClient returns undefined when oauth config missing', async () => {
    const store = new OAuthStore(clock);
    const cs = createClientsStore(store, () => undefined);
    expect(await cs.getClient('seed')).toBeUndefined();
  });

  it('getClient returns undefined for unknown id', async () => {
    const store = new OAuthStore(clock);
    const cs = createClientsStore(store, () => config);
    expect(await cs.getClient('unknown')).toBeUndefined();
  });

  it('registerClient throws when oauth config missing', () => {
    const store = new OAuthStore(clock);
    const cs = createClientsStore(store, () => undefined);
    expect(() => cs.registerClient!({
      redirect_uris: ['http://x'], token_endpoint_auth_method: 'none'
    })).toThrow(/not configured/);
  });

  it('registerClient persists a dynamically registered client', async () => {
    const store = new OAuthStore(clock);
    const cs = createClientsStore(store, () => config);
    const registered = await cs.registerClient!({
      redirect_uris: ['http://127.0.0.1:39999/callback'],
      token_endpoint_auth_method: 'none'
    });
    const fetched = await cs.getClient(registered.client_id);
    expect(fetched?.client_id).toBe(registered.client_id);
  });
});
