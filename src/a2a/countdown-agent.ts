import { v4 as uuidv4 } from 'uuid';
import type { AgentCard } from '@a2a-js/sdk';
import {
  Task,
  TaskStatusUpdateEvent,
} from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from '@a2a-js/sdk/server';
import { Kind, Role, TaskState } from './protocol';
import pkg from '../../package.json';

export const AgentId = 'countdown-agent';

export const agentCard: AgentCard = {
  name: 'Countdown Agent',
  description: 'A simple countdown agent for testing A2A tasks',
  url: '', // Will be set by routes.ts
  provider: {
    organization: 'Mock LLM',
    url: pkg.repository.url,
  },
  version: pkg.version,
  protocolVersion: '1.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'countdown',
      name: 'Countdown',
      description: 'Counts down from a specified number (default 30 seconds)',
      tags: ['countdown', 'timer', 'demo'],
      examples: [
        'Countdown from 30',
        'Start a countdown from 60',
        'Count down from 15 seconds',
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

export class CountdownAgent implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    _eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[${agentCard.name}] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: Kind.Task,
        id: taskId,
        contextId: contextId,
        status: {
          state: TaskState.Submitted,
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(initialTask);
    }

    try {
      // Extract the countdown number from the user message
      const userText = userMessage.parts
        .filter((part) => part.kind === Kind.Text)
        .map((part) => (part as { text: string }).text)
        .join(' ');

      // Look for a number in the message
      const numberMatch = userText.match(/\d+/);
      const countdownFrom = numberMatch ? parseInt(numberMatch[0], 10) : 30;

      // Publish "working" status update
      const workingStatusUpdate: TaskStatusUpdateEvent = {
        kind: Kind.StatusUpdate,
        taskId: taskId,
        contextId: contextId,
        status: {
          state: TaskState.Working,
          message: {
            kind: Kind.Message,
            role: Role.Agent,
            messageId: uuidv4(),
            parts: [
              {
                kind: Kind.Text,
                text: `Starting countdown from ${countdownFrom} seconds...`,
              },
            ],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      console.log(`[${agentCard.name}] Task ${taskId}: Starting countdown from ${countdownFrom} seconds`);
      eventBus.publish(workingStatusUpdate);

      // Countdown logic
      let current = countdownFrom;

      while (current > 0) {
        // Check if task was cancelled
        if (this.cancelledTasks.has(taskId)) {
          const cancelledUpdate: TaskStatusUpdateEvent = {
            kind: Kind.StatusUpdate,
            taskId: taskId,
            contextId: contextId,
            status: {
              state: TaskState.Failed,
              message: {
                kind: Kind.Message,
                role: Role.Agent,
                messageId: uuidv4(),
                parts: [{ kind: Kind.Text, text: 'Countdown cancelled' }],
                taskId: taskId,
                contextId: contextId,
              },
              timestamp: new Date().toISOString(),
            },
            final: true,
          };
          eventBus.publish(cancelledUpdate);
          this.cancelledTasks.delete(taskId);
          return;
        }

        // Determine delay: 10 seconds for >10, 1 second for <=10
        const delay = current > 10 ? 10000 : 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Decrement appropriately
        if (current > 10) {
          current = Math.max(10, current - 10);
        } else {
          current--;
        }

        // Publish status update
        const countdownUpdate: TaskStatusUpdateEvent = {
          kind: Kind.StatusUpdate,
          taskId: taskId,
          contextId: contextId,
          status: {
            state: TaskState.Working,
            message: {
              kind: Kind.Message,
              role: Role.Agent,
              messageId: uuidv4(),
              parts: [{ kind: Kind.Text, text: `${current} seconds remaining...` }],
              taskId: taskId,
              contextId: contextId,
            },
            timestamp: new Date().toISOString(),
          },
          final: false,
        };
        console.log(`[${agentCard.name}] Task ${taskId}: ${current} seconds remaining`);
        eventBus.publish(countdownUpdate);
      }

      // Publish final completion status
      const finalUpdate: TaskStatusUpdateEvent = {
        kind: Kind.StatusUpdate,
        taskId: taskId,
        contextId: contextId,
        status: {
          state: TaskState.Completed,
          message: {
            kind: Kind.Message,
            role: Role.Agent,
            messageId: uuidv4(),
            parts: [{ kind: Kind.Text, text: 'Countdown complete!' }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      console.log(`[${agentCard.name}] Task ${taskId}: Countdown complete`);
      eventBus.publish(finalUpdate);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[${agentCard.name}] Error processing task ${taskId}:`,
        error
      );

      // Handle errors
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: Kind.StatusUpdate,
        taskId: taskId,
        contextId: contextId,
        status: {
          state: TaskState.Failed,
          message: {
            kind: Kind.Message,
            role: Role.Agent,
            messageId: uuidv4(),
            parts: [{ kind: Kind.Text, text: `Error: ${errorMessage}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
}
