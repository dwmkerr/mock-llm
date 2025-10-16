#!/usr/bin/env node

import { createServer } from './server';
import { getConfigPath, loadConfig } from './config';
import { printConfigSummary } from './config-logger';
import pkg from '../package.json';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '6556', 10);

// Parse --config argument
const configArgIndex = process.argv.indexOf('--config');
const configPath = configArgIndex !== -1 ? process.argv[configArgIndex + 1] : getConfigPath();

const config = loadConfig(configPath);
printConfigSummary(config, `Loaded configuration from ${configPath}`);

const app = createServer(config);

app.listen(PORT, HOST, () => {
  console.log(`${pkg.name} v${pkg.version} server running on ${HOST}:${PORT}`);
}).on('error', (err) => { console.error(err); process.exit(1); });
