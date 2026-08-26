import * as fs from 'fs';

export interface TLSConfig {
  enabled?: boolean;
  certPath?: string;
  keyPath?: string;
}

export interface TLSCredentials {
  cert: Buffer;
  key: Buffer;
}

// Load the cert + key pair from the paths supplied in config. mock-llm does
// not generate or discover certs — the caller (Helm chart, cert-manager,
// local `make cert`, etc.) is responsible for producing the PEM files and
// pointing at them.
export function loadTLSCredentials(tls: TLSConfig | undefined): TLSCredentials | undefined {
  if (!tls?.enabled) {
    return undefined;
  }
  if (!tls.certPath || !tls.keyPath) {
    throw new Error('tls.enabled=true requires both tls.certPath and tls.keyPath');
  }
  const cert = fs.readFileSync(tls.certPath);
  const key = fs.readFileSync(tls.keyPath);
  return { cert, key };
}
