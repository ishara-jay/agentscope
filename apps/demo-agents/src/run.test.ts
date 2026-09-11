import { describe, expect, it } from 'vitest';
import type { AgentSpan, LlmCallMeta, LlmCallResultLike, Session } from '@agentscope/emitter';
import { FakeLlmClient } from './llm/fake.js';
import type { LlmClient, LlmRequest, LlmResult } from './llm/client.js';
import { runChat } from './run.js';

class RecordingSpan implements AgentSpan {
  constructor(private readonly events: string[]) {}

  async llmCall<T extends LlmCallResultLike>(_meta: LlmCallMeta, fn: () => Promise<T>): Promise<T> {
    this.events.push('llm');
    return fn();
  }

  async toolCall<T>(name: string, _args: unknown, fn: () => Promise<T>): Promise<T> {
    this.events.push(`tool:${name}`);
    return fn();
  }

  async delegate<T>(name: string, _task: string, fn: (child: AgentSpan) => Promise<T>): Promise<T> {
    this.events.push(`delegate:${name}`);
    this.events.push(`agent:${name}:start`);
    try {
      return await fn(new RecordingSpan(this.events));
    } finally {
      this.events.push(`agent:${name}:finish`);
    }
  }
}

const recordingSession = (events: string[]): Session => ({
  async agent<T>(name: string, _options: { input?: string }, fn: (span: AgentSpan) => Promise<T>) {
    events.push(`agent:${name}:start`);
    try {
      return await fn(new RecordingSpan(events));
    } finally {
      events.push(`agent:${name}:finish`);
    }
  },
  async flush() {
    events.push('flush');
  },
});

describe('agent execution', () => {
  it('runs orchestrator, researcher/tools, writer, and final selection in order', async () => {
    const events: string[] = [];
    const response = await runChat([{ role: 'user', content: 'Explain traces' }], {
      client: new FakeLlmClient(),
      createSession: () => recordingSession(events),
    });

    expect(response).toMatch(/^Final response/);
    expect(response).not.toMatch(/^Draft answer/);
    expect(events).toEqual([
      'agent:orchestrator:start',
      'llm',
      'delegate:researcher',
      'agent:researcher:start',
      'llm',
      'tool:search',
      'tool:read_source',
      'llm',
      'agent:researcher:finish',
      'delegate:writer',
      'agent:writer:start',
      'llm',
      'agent:writer:finish',
      'llm',
      'agent:orchestrator:finish',
      'flush',
    ]);
  });

  it('forwards the complete multi-turn history to LLM requests', async () => {
    const requests: LlmRequest[] = [];
    const fake = new FakeLlmClient();
    const client: LlmClient = {
      provider: 'recording-fake',
      async generate(request: LlmRequest): Promise<LlmResult> {
        requests.push(request);
        return fake.generate(request);
      },
    };
    const history = [
      { role: 'user' as const, content: 'First topic' },
      { role: 'assistant' as const, content: 'First answer' },
      { role: 'user' as const, content: 'Now relate it to testing' },
    ];

    const response = await runChat(history, {
      client,
      createSession: () => recordingSession([]),
    });

    expect(requests).not.toHaveLength(0);
    for (const request of requests) {
      expect(request.messages).toEqual(expect.arrayContaining(history));
    }
    expect(response).toContain('First topic');
  });

  it('flushes the emitter after agent errors', async () => {
    const events: string[] = [];
    const client: LlmClient = {
      provider: 'broken',
      generate: () => Promise.reject(new Error('model failed')),
    };

    await expect(
      runChat([{ role: 'user', content: 'Fail please' }], {
        client,
        createSession: () => recordingSession(events),
      }),
    ).rejects.toThrow('model failed');
    expect(events.at(-1)).toBe('flush');
  });
});
