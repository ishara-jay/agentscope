import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ChatRequest, ChatResponse, type ChatMessage } from '@agentscope/contract';
import { runChat } from './run.js';

export type ChatRunner = (messages: ChatMessage[]) => Promise<string>;
export type ApiResult = { status: number; body: unknown };

export async function handleChatPayload(
  payload: unknown,
  runner: ChatRunner = runChat,
): Promise<ApiResult> {
  const parsed = ChatRequest.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Invalid chat request' } };
  }

  try {
    const content = await runner(parsed.data.messages);
    return {
      status: 200,
      body: ChatResponse.parse({ message: { role: 'assistant', content } }),
    };
  } catch (error) {
    console.error('Chat execution failed', error);
    return { status: 500, body: { error: 'Agent execution failed' } };
  }
}

const sendJson = (response: ServerResponse, result: ApiResult): void => {
  response.writeHead(result.status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(result.body));
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 1_000_000) throw new Error('Request body is too large');
  }
  return JSON.parse(body);
};

export function createChatServer(runner: ChatRunner = runChat): Server {
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, { status: 200, body: { status: 'ok' } });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/chat') {
      sendJson(response, { status: 404, body: { error: 'Not found' } });
      return;
    }
    try {
      sendJson(response, await handleChatPayload(await readJson(request), runner));
    } catch {
      sendJson(response, { status: 400, body: { error: 'Invalid JSON request' } });
    }
  });
}
