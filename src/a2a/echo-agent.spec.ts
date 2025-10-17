import { echoAgent } from './echo-agent';
import { DefaultExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { Kind, Role } from './protocol';
import type { Message } from '@a2a-js/sdk';

describe('EchoAgent', () => {
  it('should echo back user message as a direct Message', async () => {
    const agent = echoAgent.executor;
    const eventBus = new DefaultExecutionEventBus();
    const events: unknown[] = [];

    eventBus.on('event', (event) => events.push(event));

    const message: Message = {
      messageId: 'test-1',
      kind: Kind.Message,
      role: Role.User,
      parts: [{ kind: Kind.Text, text: 'Hello, world!' }],
      contextId: 'ctx-1',
      taskId: 'task-1',
    };

    const requestContext = new RequestContext(message, 'task-1', 'ctx-1', undefined);

    await agent.execute(requestContext, eventBus);

    // Verify we got exactly one Message event
    expect(events.length).toBe(1);

    const responseMessage = events[0] as Message;
    expect(responseMessage).toMatchObject({
      kind: Kind.Message,
      role: Role.Agent,
      taskId: 'task-1',
      contextId: 'ctx-1',
      parts: [{ kind: Kind.Text, text: 'Hello, world!' }],
    });
  });
});
