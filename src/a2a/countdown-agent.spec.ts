import { CountdownAgent } from './countdown-agent';
import { DefaultExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { Kind, Role, TaskState } from './protocol';
import type { Message, Task } from '@a2a-js/sdk';

describe('CountdownAgent', () => {
  it('should countdown from specified number and publish proper events', async () => {
    const agent = new CountdownAgent();
    const eventBus = new DefaultExecutionEventBus();
    const events: unknown[] = [];

    eventBus.on('event', (event) => events.push(event));

    const message: Message = {
      messageId: 'test-1',
      kind: Kind.Message,
      role: Role.User,
      parts: [{ kind: Kind.Text, text: 'Countdown from 3' }],
      contextId: 'ctx-1',
      taskId: 'task-1',
    };

    const requestContext = new RequestContext(message, 'task-1', 'ctx-1', undefined);

    await agent.execute(requestContext, eventBus);

    // Verify first event is a proper Task object with key fields
    expect(events.length).toBeGreaterThan(0);

    const firstEvent = events[0] as Task;
    expect(firstEvent).toMatchObject({
      kind: Kind.Task,
      id: 'task-1',
      contextId: 'ctx-1',
      status: {
        state: TaskState.Submitted,
      },
    });

    // Verify history array contains the initial message
    expect(firstEvent.history).toBeDefined();
    expect(Array.isArray(firstEvent.history)).toBe(true);
    expect(firstEvent.history?.length).toBe(1);
    expect(firstEvent.history?.[0]).toMatchObject({
      messageId: 'test-1',
      kind: Kind.Message,
      role: Role.User,
    });

    // Verify final event is a completion status update
    const lastEvent = events[events.length - 1];
    expect(lastEvent).toMatchObject({
      kind: Kind.StatusUpdate,
      taskId: 'task-1',
      contextId: 'ctx-1',
      status: {
        state: TaskState.Completed,
      },
      final: true,
    });
  });
});
