import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { createServer } from './src/server';
import { getDefaultConfig } from './src/config';

const execAsync = promisify(exec);

describe('samples', () => {
  // Set DISABLE_START_SERVER=1 to run tests against an existing server (e.g., deployed via Helm)
  const shouldStartServer = process.env.DISABLE_START_SERVER !== '1';
  const app = shouldStartServer ? createServer(getDefaultConfig()) : null;
  let server: http.Server | null = null;

  // Get all sample scripts
  const samplesDir = path.join(__dirname, 'samples');
  const sampleScripts = fs.readdirSync(samplesDir)
    .filter(file => file.endsWith('.sh'))
    .sort();

  beforeAll((done) => {
    if (shouldStartServer) {
      server = app!.listen(6556, done);
    } else {
      done();
    }
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it.each(sampleScripts)('should run %s', async (script) => {
    const samplePath = path.join(samplesDir, script);
    await execAsync(`bash ${samplePath}`);
  });
});
