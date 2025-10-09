#!/usr/bin/env node

import { createServer } from './server';
import { getConfigPath, loadConfig } from './config';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8080', 10);

// Parse --config argument
const configArgIndex = process.argv.indexOf('--config');
const configPath = configArgIndex !== -1 ? process.argv[configArgIndex + 1] : getConfigPath();

const config = loadConfig(configPath);
console.log(`Loaded configuration from ${configPath} - ${config.rules.length} rule(s)`);

const app = createServer(config);

app.listen(PORT, HOST, () => {
  console.log(`mock-llm server running on ${HOST}:${PORT}`);
}).on('error', (err) => { console.error(err); process.exit(1); });
