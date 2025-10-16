import express from 'express';
import {
  InMemoryTaskStore,
  DefaultRequestHandler,
} from '@a2a-js/sdk/server';
import { A2AExpressApp } from '@a2a-js/sdk/server/express';
import { CountdownAgent, agentCard, AgentId } from './countdown-agent';

export function setupA2ARoutes(app: express.Application, host: string, port: number): void {
  // Patch the agent card URL with actual host/port
  const agentCardWithUrl = {
    ...agentCard,
    url: `http://${host}:${port}/a2a/agents/${AgentId}`,
  };
  // Create task store and agent executor
  const taskStore = new InMemoryTaskStore();
  const agentExecutor = new CountdownAgent();

  // Create request handler
  const requestHandler = new DefaultRequestHandler(
    agentCardWithUrl,
    taskStore,
    agentExecutor
  );

  // Create A2A Express app
  const a2aApp = new A2AExpressApp(requestHandler);

  // Create a sub-app for the agent
  const agentApp = express();
  a2aApp.setupRoutes(agentApp);

  // Mount the agent app at the agent-specific path
  app.use(`/a2a/agents/${AgentId}`, agentApp);

  console.log('Loaded A2A agents:');
  console.log(`  - ${AgentId}: http://${host}:${port}/a2a/agents/${AgentId}/.well-known/agent-card.json`);
}
