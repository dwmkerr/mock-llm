import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createServer } from './src/server';
import { getDefaultConfig } from './src/config';

const execAsync = promisify(exec);

describe('samples', () => {
  const app = createServer(getDefaultConfig());
  let server: ReturnType<typeof app.listen>;

  // Get all sample scripts
  const samplesDir = path.join(__dirname, 'samples');
  const sampleScripts = fs.readdirSync(samplesDir)
    .filter(file => file.endsWith('.sh'))
    .sort();

  beforeAll((done) => {
    server = app.listen(6556, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it.each(sampleScripts)('should run %s', async (script) => {
    const samplePath = path.join(samplesDir, script);
    await execAsync(`bash ${samplePath}`);
  });
});
