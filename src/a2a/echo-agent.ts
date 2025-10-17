import { v4 as uuidv4 } from 'uuid';
import type { AgentCard } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from '@a2a-js/sdk/server';
import { Kind, Role } from './protocol';
import { A2AAgent } from './types';
import pkg from '../../package.json';

const AgentId = 'echo-agent';

const agentCard: AgentCard = {
  name: 'Echo Agent',
  description: 'Echoes back user messages',
  url: '',
  provider: {
    organization: 'Mock LLM',
    url: pkg.repository.url,
  },
  version: pkg.version,
  protocolVersion: '1.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Echoes back user messages',
      tags: ['echo', 'demo'],
      examples: ['Hello!', 'Test message'],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

class EchoAgentExecutor implements AgentExecutor {
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // Echo is instant, nothing to cancel
  }

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { userMessage, taskId, contextId } = requestContext;

    // Extract user text
    const userText = userMessage.parts
      .filter((part) => part.kind === Kind.Text)
      .map((part) => (part as { text: string }).text)
      .join(' ');

    // Simple response: just publish a Message directly
    eventBus.publish({
      kind: Kind.Message,
      role: Role.Agent,
      messageId: uuidv4(),
      parts: [{ kind: Kind.Text, text: userText }],
      taskId,
      contextId,
    });
  }
}

export const echoAgent: A2AAgent = {
  id: AgentId,
  card: agentCard,
  executor: new EchoAgentExecutor(),
};
