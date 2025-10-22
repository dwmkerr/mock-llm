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

const AgentId = 'message-counter-agent';

const agentCard: AgentCard = {
  name: 'Message Counter Agent',
  description: 'Counts messages received per conversation context',
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
      id: 'count',
      name: 'Count Messages',
      description: 'Tracks and reports message count per context',
      tags: ['counter', 'demo'],
      examples: ['Send a message', 'How many messages'],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

//  Track the number of messages per context.
const messageCounts = new Map<string, number>();

class MessageCounterExecutor implements AgentExecutor {
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // Instant response, nothing to cancel
  }

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { taskId, contextId } = requestContext;

    //  Grab the number of messages, add one for this new incoming message.
    const count = (messageCounts.get(contextId) || 0) + 1;
    messageCounts.set(contextId, count);

    //  Respond with the number of messages received.
    eventBus.publish({
      kind: Kind.Message,
      role: Role.Agent,
      messageId: uuidv4(),
      parts: [{ kind: Kind.Text, text:  `${count} message(s) recieved` }],
      taskId,
      contextId,
    });
  }
}

export const messageCounterAgent: A2AAgent = {
  id: AgentId,
  card: agentCard,
  executor: new MessageCounterExecutor(),
};
