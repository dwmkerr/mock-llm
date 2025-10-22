import { messageCounterAgent } from './message-counter-agent';
import { DefaultExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { Kind, Role } from './protocol';
import type { Message } from '@a2a-js/sdk';

const createMessage = (messageId: string, taskId: string, contextId: string, text: string): Message => ({
  messageId,
  kind: Kind.Message,
  role: Role.User,
  parts: [{ kind: Kind.Text, text }],
  contextId,
  taskId,
});

describe('MessageCounterAgent', () => {
  it('should increment message count per context', async () => {
    const agent = messageCounterAgent.executor;
    const eventBus = new DefaultExecutionEventBus();
    const events: unknown[] = [];

    eventBus.on('event', (event) => events.push(event));

    const contextId = 'ctx-1';

    const message1 = createMessage('test-1', 'task-1', contextId, 'First message');
    await agent.execute(new RequestContext(message1, 'task-1', contextId, undefined), eventBus);

    const message2 = createMessage('test-2', 'task-2', contextId, 'Second message');
    await agent.execute(new RequestContext(message2, 'task-2', contextId, undefined), eventBus);

    expect(events.length).toBe(2);

    const response1 = events[0] as Message;
    expect(response1).toMatchObject({
      kind: Kind.Message,
      role: Role.Agent,
      taskId: 'task-1',
      contextId: 'ctx-1',
      parts: [{ kind: Kind.Text, text: '1 message(s) received' }],
    });

    const response2 = events[1] as Message;
    expect(response2).toMatchObject({
      kind: Kind.Message,
      role: Role.Agent,
      taskId: 'task-2',
      contextId: 'ctx-1',
      parts: [{ kind: Kind.Text, text: '2 message(s) received' }],
    });
  });
});
