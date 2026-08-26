import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';
import * as tls from 'tls';
import { execFileSync } from 'child_process';
import express from 'express';
import { loadTLSCredentials } from './index';

describe('loadTLSCredentials', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-llm-tls-'));
  const certPath = path.join(tmpDir, 'tls.crt');
  const keyPath = path.join(tmpDir, 'tls.key');

  beforeAll(() => {
    // Generate a self-signed cert for test fixtures. openssl is available on
    // every platform the CI matrix runs on; if this changes, swap for a
    // vendored fixture PEM.
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath,
      '-out', certPath,
      '-days', '1',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'
    ], { stdio: 'pipe' });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined when tls is absent', () => {
    expect(loadTLSCredentials(undefined)).toBeUndefined();
  });

  it('returns undefined when tls.enabled is false', () => {
    expect(loadTLSCredentials({ enabled: false, certPath, keyPath })).toBeUndefined();
  });

  it('throws when enabled without certPath', () => {
    expect(() => loadTLSCredentials({ enabled: true, keyPath })).toThrow(
      /requires both tls.certPath and tls.keyPath/
    );
  });

  it('throws when enabled without keyPath', () => {
    expect(() => loadTLSCredentials({ enabled: true, certPath })).toThrow(
      /requires both tls.certPath and tls.keyPath/
    );
  });

  it('reads cert and key from the configured paths', () => {
    const creds = loadTLSCredentials({ enabled: true, certPath, keyPath });
    expect(creds).toBeDefined();
    expect(creds!.cert.toString()).toContain('BEGIN CERTIFICATE');
    expect(creds!.key.toString()).toMatch(/BEGIN (?:RSA |)PRIVATE KEY/);
  });

  it('serves HTTPS requests when mounted on https.createServer', async () => {
    const creds = loadTLSCredentials({ enabled: true, certPath, keyPath })!;
    const app = express();
    app.get('/health', (_, res) => { res.json({ status: 'healthy' }); });
    const server = https.createServer(creds, app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };
    try {
      // Trust the fixture cert for this one request.
      const agent = new https.Agent({
        ca: creds.cert,
        checkServerIdentity: (_host: string, _cert: tls.PeerCertificate) => undefined
      });
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = https.get(`https://localhost:${port}/health`, { agent }, (r) => {
          let data = '';
          r.on('data', (c) => { data += c; });
          r.on('end', () => resolve({ status: r.statusCode ?? 0, body: data }));
        });
        req.on('error', reject);
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'healthy' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
