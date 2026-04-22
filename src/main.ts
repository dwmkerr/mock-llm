#!/usr/bin/env node

import * as http from 'http';
import * as https from 'https';
import { createServer } from './server';
import { getConfigPath, loadConfig } from './config';
import { printConfigSummary } from './config-logger';
import { loadTLSCredentials } from './tls';
import pkg from '../package.json';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '6556', 10);

// Parse --config argument
const configArgIndex = process.argv.indexOf('--config');
const configPath = configArgIndex !== -1 ? process.argv[configArgIndex + 1] : getConfigPath();

const config = loadConfig(configPath);
printConfigSummary(config, `Loaded configuration from ${configPath}`);

// Env vars override anything in the config file. This is the contract between
// the Helm chart (which mounts a Secret and sets MOCK_LLM_TLS_CERT/KEY) and
// the runtime — operators never need to edit the mounted config to wire TLS.
if (process.env.MOCK_LLM_TLS_ENABLED === 'true') {
  config.tls = {
    ...config.tls,
    enabled: true,
    certPath: process.env.MOCK_LLM_TLS_CERT ?? config.tls?.certPath,
    keyPath: process.env.MOCK_LLM_TLS_KEY ?? config.tls?.keyPath
  };
}

const app = createServer(config, HOST, PORT);
const tlsCredentials = loadTLSCredentials(config.tls);
const server = tlsCredentials
  ? https.createServer(tlsCredentials, app)
  : http.createServer(app);
const scheme = tlsCredentials ? 'https' : 'http';

server.listen(PORT, HOST, () => {
  console.log(`${pkg.name} v${pkg.version} server running on ${scheme}://${HOST}:${PORT}`);
}).on('error', (err) => { console.error(err); process.exit(1); });
