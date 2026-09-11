import type { AgentSpan, Session } from '@agentscope/emitter';
import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from './llm/fake.js';
import type { LlmClient, ToolImplementation } from './llm/client.js';
import { runTask } from './run.js';
import { readSourceTool, searchTool } from './tools/index.js';

const span: AgentSpan = {
  llmCall: (_meta, fn) => fn(),
  toolCall: (_name, _args, fn) => fn(),
  delegate: (_name, _task, fn) => fn(span),
};

const sessionFor = (onFlush: () => void): Session => ({
  agent: async (_name, _options, fn) => fn(span),
  flush: async () => onFlush(),
});

describe('fake agent execution', () => {
  it('runs the orchestrator, tools, and delegates to a final response', async () => {
    const order: string[] = [];
    const search: ToolImplementation<{ query: string }, unknown> = {
      ...searchTool,
      execute: async (args) => {
        order.push('search');
        return searchTool.execute(args);
      },
    };
    const readSource: ToolImplementation<{ sourceId: string }, unknown> = {
      ...readSourceTool,
      execute: async (args) => {
        order.push('read_source');
        return readSourceTool.execute(args);
      },
    };

    const response = await runTask('Explain reliable demos', {
      client: new FakeLlmClient(),
      tools: [search, readSource],
      createSession: () => sessionFor(() => undefined),
    });

    expect(response).toContain('Final response');
    expect(order).toEqual(['search', 'read_source']);
  });

  it('flushes the emitter session when agent execution fails', async () => {
    let flushes = 0;
    const failingClient: LlmClient = {
      provider: 'test',
      generate: async () => {
        throw new Error('provider failed');
      },
    };

    await expect(
      runTask('This fails', {
        client: failingClient,
        createSession: () =>
          sessionFor(() => {
            flushes += 1;
          }),
      }),
    ).rejects.toThrow('provider failed');
    expect(flushes).toBe(1);
  });
});
