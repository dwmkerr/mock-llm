import express from 'express';
import {
  InMemoryTaskStore,
  DefaultRequestHandler,
} from '@a2a-js/sdk/server';
import { A2AExpressApp } from '@a2a-js/sdk/server/express';
import { countdownAgent } from './countdown-agent';
import { echoAgent } from './echo-agent';
import { A2AAgent } from './types';

const agents: A2AAgent[] = [countdownAgent, echoAgent];

export function setupA2ARoutes(app: express.Application, host: string, port: number): void {
  console.log('Loaded A2A agents:');

  for (const agent of agents) {
    // Patch the agent card URL with actual host/port
    const agentCardWithUrl = {
      ...agent.card,
      url: `http://${host}:${port}/a2a/agents/${agent.id}`,
    };

    // Create task store and request handler
    const taskStore = new InMemoryTaskStore();
    const requestHandler = new DefaultRequestHandler(
      agentCardWithUrl,
      taskStore,
      agent.executor
    );

    // Create A2A Express app
    const a2aApp = new A2AExpressApp(requestHandler);

    // Create a sub-app for the agent
    const agentApp = express();
    a2aApp.setupRoutes(agentApp);

    // Mount the agent app at the agent-specific path
    app.use(`/a2a/agents/${agent.id}`, agentApp);

    console.log(`  - ${agent.id}: http://${host}:${port}/a2a/agents/${agent.id}/.well-known/agent-card.json`);
  }
}
