import type { ChatMessage } from '@agentscope/contract';
import { startSession, type Session } from '@agentscope/emitter';
import { runOrchestrator } from './agents/orchestrator.js';
import type { LlmClient, ToolImplementation } from './llm/client.js';
import { createLlmClient } from './llm/provider.js';
import { readSourceTool, searchTool } from './tools/index.js';

export type RunChatOptions = {
  client?: LlmClient;
  tools?: ToolImplementation[];
  createSession?: () => Session;
};

export async function runChat(
  history: ChatMessage[],
  options: RunChatOptions = {},
): Promise<string> {
  const client = options.client ?? createLlmClient();
  const tools = options.tools ?? [searchTool, readSourceTool];
  const toolSet = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const session =
    options.createSession?.() ??
    startSession({
      endpoint: process.env.AGENTSCOPE_ENDPOINT ?? 'http://localhost:3001',
      onError: 'warn',
    });
  const latestTask = [...history].reverse().find((message) => message.role === 'user')?.content;
  if (!latestTask) throw new Error('Conversation must contain a user message');

  try {
    return await session.agent('orchestrator', { input: latestTask }, (span) =>
      runOrchestrator(span, client, history, toolSet),
    );
  } finally {
    await session.flush();
  }
}
