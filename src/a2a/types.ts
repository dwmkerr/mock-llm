import type { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';

export interface A2AAgent {
  id: string;
  card: AgentCard;
  executor: AgentExecutor;
}
