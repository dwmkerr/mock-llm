#!/usr/bin/env node

import express from 'express';
import * as path from 'path';
import { loadConfig, handleRequest, ChatRequest } from './mock-llm';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8080', 10);

// Parse --config argument
const configArgIndex = process.argv.indexOf('--config');
const configPath = configArgIndex !== -1 ? process.argv[configArgIndex + 1] : undefined;

const config = loadConfig(configPath);
const configPathUsed = configPath || path.join(process.cwd(), 'mock-llm.yaml');
console.log(`Loaded configuration from ${configPathUsed} - ${config.rules.length} rule(s)`);

const app = express();
app.use(express.json());

app.post('*', (req, res) => {
  console.log(`${req.method} ${req.path}`);

  const request: ChatRequest = req.body;
  const response = handleRequest(config, request, req.path);

  res.status(response.status).json(JSON.parse(response.body));
});

app.listen(PORT, HOST, () => {
  console.log(`mock-llm server running on ${HOST}:${PORT}`);
});
