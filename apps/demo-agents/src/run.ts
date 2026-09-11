import { startSession, type Session } from '@agentscope/emitter';
import { runOrchestrator } from './agents/orchestrator.js';
import type { LlmClient, ToolImplementation } from './llm/client.js';
import { createLlmClient } from './llm/provider.js';
import { readSourceTool, searchTool } from './tools/index.js';

export type RunTaskOptions = {
  client?: LlmClient;
  tools?: ToolImplementation[];
  createSession?: () => Session;
};

export async function runTask(task: string, options: RunTaskOptions = {}): Promise<string> {
  const normalizedTask = task.trim();
  if (!normalizedTask) throw new Error('A non-empty task is required');

  const client = options.client ?? createLlmClient();
  const tools = options.tools ?? [searchTool, readSourceTool];
  const toolSet = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const session =
    options.createSession?.() ??
    startSession({
      endpoint: process.env.AGENTSCOPE_ENDPOINT ?? 'http://localhost:3001',
      onError: 'warn',
    });

  try {
    return await session.agent('orchestrator', { input: normalizedTask }, (span) =>
      runOrchestrator(span, client, normalizedTask, toolSet),
    );
  } finally {
    await session.flush();
  }
}
