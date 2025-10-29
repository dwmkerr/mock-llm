import type { Response } from 'express';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { StreamingConfig } from './config';

function splitIntoChunks(content: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [''];
}

function createChunks(
  id: string,
  model: string,
  created: number,
  contentChunks: string[]
): ChatCompletionChunk[] {
  if (contentChunks.length === 0) {
    return [];
  }

  const chunks: ChatCompletionChunk[] = contentChunks.map(content => ({
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null
      }
    ]
  }));

  // Augment first chunk with role
  chunks[0].choices[0].delta.role = 'assistant';

  // Augment last chunk with finish_reason
  chunks[chunks.length - 1].choices[0].finish_reason = 'stop';

  return chunks;
}

export function streamResponse(
  res: Response,
  responseJson: any,
  status: number,
  config: StreamingConfig
): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Handle error responses - streaming errors are sent as 200 OK with error in data
  if (status >= 400 || responseJson.error) {
    res.status(200);
    res.write(`data: ${JSON.stringify(responseJson)}\n\n`);
    res.end();
    return;
  }

  res.status(status);

  // Extract content and metadata from response
  const content = responseJson.choices?.[0]?.message?.content || '';
  const id = responseJson.id || 'chatcmpl-mock';
  const model = responseJson.model || 'gpt-4';
  const created = responseJson.created || Math.floor(Date.now() / 1000);

  // Create chunks from content
  const contentChunks = splitIntoChunks(content, config.chunkSize);
  const chunks = createChunks(id, model, created, contentChunks);

  let index = 0;
  const interval = setInterval(() => {
    if (index < chunks.length) {
      res.write(`data: ${JSON.stringify(chunks[index])}\n\n`);
      index++;
    } else {
      // Send [DONE]
      res.write('data: [DONE]\n\n');
      res.end();
      clearInterval(interval);
    }
  }, config.chunkIntervalMs);
}
