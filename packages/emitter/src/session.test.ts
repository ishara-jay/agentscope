import { TraceEvent as TraceEventSchema } from '@agentscope/contract';
import type { TraceEvent } from '@agentscope/contract';
import { describe, expect, it } from 'vitest';
import { createSession, type EventDelivery, type SessionRuntime } from './session.js';
import type { LlmCallMeta, LlmCallResultLike } from './types.js';

const nextUuid = (): (() => string) => {
  let value = 1;
  return () => `00000000-0000-4000-8000-${String(value++).padStart(12, '0')}`;
};

const sequence = <T>(values: readonly T[]): (() => T) => {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Test sequence exhausted');
    return values[index++]!;
  };
};

type HarnessOptions = {
  onError?: 'warn' | 'silent';
  wallNow?: () => Date;
  monotonicNow?: () => number;
  delivery?: EventDelivery;
};

const createHarness = (options: HarnessOptions = {}) => {
  const events: TraceEvent[] = [];
  const warnings: string[] = [];
  let wallTime = Date.parse('2026-09-17T09:00:00.000Z');
  let monotonicTime = 0;
  let flushes = 0;
  const delivery = options.delivery ?? {
    emit: (event: TraceEvent) => {
      events.push(event);
    },
    flush: async () => {
      flushes += 1;
    },
  };
  const runtime: SessionRuntime = {
    wallNow: options.wallNow ?? (() => new Date(wallTime++)),
    monotonicNow: options.monotonicNow ?? (() => (monotonicTime += 10)),
    newId: nextUuid(),
    delivery,
    warn: (message) => {
      warnings.push(message);
    },
  };

  return {
    session: createSession({ endpoint: 'http://localhost:0', onError: options.onError }, runtime),
    events,
    warnings,
    flushCount: () => flushes,
  };
};

const errorFrom = async (work: () => Promise<unknown>): Promise<unknown> => {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error('Expected work to reject');
};

describe('event-producing emitter wrappers', () => {
  it('emits all five event types in order with valid IDs, content, and parent relationships', async () => {
    const { session, events } = createHarness();
    const planResult = {
      text: 'plan',
      usage: { inputTokens: 12, outputTokens: 3 },
    };
    const toolResult = { hits: ['a', 'b'] };
    const toolCallResult = {
      toolCalls: [{ id: 'call-1', name: 'search', args: { q: 'x' } }],
      usage: { inputTokens: 20, outputTokens: 4 },
    };

    const result = await session.agent('orchestrator', { input: 'task' }, async (span) => {
      const plan = await span.llmCall(
        { model: 'fake-model', provider: 'fake', prompt: '{"messages":["plan"]}' },
        () => Promise.resolve(planResult),
      );
      expect(plan).toBe(planResult);

      const childResult = await span.delegate('researcher', 'dig', async (child) => {
        const tool = await child.toolCall('search', { q: 'x' }, () => Promise.resolve(toolResult));
        expect(tool).toBe(toolResult);

        const call = await child.llmCall(
          { model: 'fake-model', provider: 'fake', prompt: '{"messages":["summarize"]}' },
          () => Promise.resolve(toolCallResult),
        );
        expect(call).toBe(toolCallResult);
        return 'research complete';
      });
      expect(childResult).toBe('research complete');
      return 'root complete';
    });

    expect(result).toBe('root complete');
    expect(events.map((event) => event.type)).toEqual([
      'agent_started',
      'llm_called',
      'delegated',
      'agent_started',
      'tool_called',
      'llm_called',
      'agent_finished',
      'agent_finished',
    ]);
    for (const event of events) expect(TraceEventSchema.parse(event)).toEqual(event);

    expect(new Set(events.map((event) => event.session_id))).toHaveLength(1);
    expect(new Set(events.map((event) => event.event_id))).toHaveLength(events.length);

    const rootStarted = events[0]!;
    const firstLlm = events[1]!;
    const delegated = events[2]!;
    const childStarted = events[3]!;
    const toolCalled = events[4]!;
    const secondLlm = events[5]!;
    const childFinished = events[6]!;
    const rootFinished = events[7]!;
    expect(rootStarted.parent_span_id).toBeNull();
    expect(firstLlm.parent_span_id).toBe(rootStarted.span_id);
    expect(delegated.span_id).toBe(rootStarted.span_id);
    expect(delegated.parent_span_id).toBeNull();
    expect(childStarted.parent_span_id).toBe(rootStarted.span_id);
    expect(toolCalled.parent_span_id).toBe(childStarted.span_id);
    expect(secondLlm.parent_span_id).toBe(childStarted.span_id);
    expect(childFinished.span_id).toBe(childStarted.span_id);
    expect(rootFinished.span_id).toBe(rootStarted.span_id);

    expect(firstLlm).toMatchObject({
      type: 'llm_called',
      payload: {
        model: 'fake-model',
        provider: 'fake',
        input_tokens: 12,
        output_tokens: 3,
        duration_ms: 10,
        prompt: '{"messages":["plan"]}',
        response: 'plan',
      },
    });
    expect(toolCalled).toMatchObject({
      type: 'tool_called',
      payload: {
        tool_name: 'search',
        status: 'success',
        args: { q: 'x' },
        result: toolResult,
        duration_ms: 10,
      },
    });
    expect(secondLlm).toMatchObject({
      type: 'llm_called',
      payload: { response: JSON.stringify(toolCallResult.toolCalls) },
    });
    expect(childFinished).toMatchObject({
      type: 'agent_finished',
      payload: { status: 'success', output: 'research complete' },
    });
    expect(rootFinished).toMatchObject({
      type: 'agent_finished',
      payload: { status: 'success', output: 'root complete' },
    });

    const workSpanIds = [rootStarted, firstLlm, childStarted, toolCalled, secondLlm].map(
      (event) => event.span_id,
    );
    expect(new Set(workSpanIds)).toHaveLength(workSpanIds.length);
  });

  it('returns a non-string agent result unchanged and omits output', async () => {
    const { session, events } = createHarness();
    const value = { answer: 42 };

    const result = await session.agent('worker', {}, () => Promise.resolve(value));

    expect(result).toBe(value);
    const finished = events.find((event) => event.type === 'agent_finished');
    expect(finished?.payload).not.toHaveProperty('output');
  });

  it('emits one safe agent error and preserves a non-Error thrown value', async () => {
    const { session, events } = createHarness();
    const thrown = { secret: 'do not record this' };

    const caught = await errorFrom(() => session.agent('worker', {}, () => Promise.reject(thrown)));

    expect(caught).toBe(thrown);
    const finished = events.filter((event) => event.type === 'agent_finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({
      payload: { status: 'error', error: 'Unknown error' },
    });
    expect(JSON.stringify(events)).not.toContain(thrown.secret);
  });

  it('emits a failed tool completion before rethrowing the original error', async () => {
    const { session, events } = createHarness();
    const boom = new Error('tool failed');

    const caught = await errorFrom(() =>
      session.agent('worker', {}, (span) =>
        span.toolCall('search', { q: 'x' }, () => Promise.reject(boom)),
      ),
    );

    expect(caught).toBe(boom);
    expect(events.map((event) => event.type)).toEqual([
      'agent_started',
      'tool_called',
      'agent_finished',
    ]);
    expect(events[1]).toMatchObject({
      type: 'tool_called',
      payload: {
        status: 'error',
        args: { q: 'x' },
        result: { error: 'tool failed' },
      },
    });
    expect(events[2]).toMatchObject({
      type: 'agent_finished',
      payload: { status: 'error', error: 'tool failed' },
    });
  });

  it('preserves an LLM rejection without creating an invalid completion event', async () => {
    const { session, events } = createHarness();
    const boom = new Error('model failed');

    const caught = await errorFrom(() =>
      session.agent('worker', {}, (span) =>
        span.llmCall({ model: 'm', provider: 'p', prompt: 'prompt' }, () => Promise.reject(boom)),
      ),
    );

    expect(caught).toBe(boom);
    expect(events.map((event) => event.type)).toEqual(['agent_started', 'agent_finished']);
    expect(events[1]).toMatchObject({
      type: 'agent_finished',
      payload: { status: 'error', error: 'model failed' },
    });
  });

  it('uses completion wall time and monotonic durations even when clocks move backward', async () => {
    const wallNow = sequence([
      new Date('2026-09-17T09:00:10.000Z'),
      new Date('2026-09-17T09:00:09.000Z'),
      new Date('2026-09-17T09:00:08.000Z'),
      new Date('2026-09-17T09:00:07.000Z'),
    ]);
    const monotonicNow = sequence([100, 125, 200, 190]);
    const { session, events } = createHarness({ wallNow, monotonicNow });

    await session.agent('worker', {}, async (span) => {
      await span.llmCall({ model: 'm', provider: 'p', prompt: 'prompt' }, () =>
        Promise.resolve({ text: 'answer', usage: { inputTokens: 1, outputTokens: 2 } }),
      );
      await span.toolCall('tool', {}, () => Promise.resolve('result'));
    });

    const llm = events.find((event) => event.type === 'llm_called');
    const tool = events.find((event) => event.type === 'tool_called');
    expect(llm).toMatchObject({
      timestamp: '2026-09-17T09:00:09.000Z',
      payload: { duration_ms: 25 },
    });
    expect(tool).toMatchObject({
      timestamp: '2026-09-17T09:00:08.000Z',
      payload: { duration_ms: 0 },
    });
  });

  it('contains delivery failures in warning and silent modes', async () => {
    const failingDelivery: EventDelivery = {
      emit: () => {
        throw new Error('secret transport detail');
      },
      flush: () => Promise.reject(new Error('secret flush detail')),
    };
    const warned = createHarness({ delivery: failingDelivery });
    const value = { ok: true };

    await expect(warned.session.agent('worker', {}, () => Promise.resolve(value))).resolves.toBe(
      value,
    );
    await expect(warned.session.flush()).resolves.toBeUndefined();
    expect(warned.warnings).toEqual([
      '[agentscope] telemetry emission failed',
      '[agentscope] telemetry emission failed',
      '[agentscope] telemetry emission failed',
    ]);
    expect(warned.warnings.join(' ')).not.toContain('secret');

    const silent = createHarness({ delivery: failingDelivery, onError: 'silent' });
    const boom = new Error('agent failed');
    const caught = await errorFrom(() =>
      silent.session.agent('worker', {}, () => Promise.reject(boom)),
    );
    await expect(silent.session.flush()).resolves.toBeUndefined();
    expect(caught).toBe(boom);
    expect(silent.warnings).toEqual([]);
  });

  it('waits for delivery flush', async () => {
    let finishFlush: (() => void) | undefined;
    const pendingFlush = new Promise<void>((resolve) => {
      finishFlush = resolve;
    });
    const { session } = createHarness({
      delivery: { emit: () => undefined, flush: () => pendingFlush },
    });
    let settled = false;

    const flushing = session.flush().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishFlush?.();
    await flushing;
    expect(settled).toBe(true);
  });

  it('requires prompt metadata and normalized usage at compile time', () => {
    const validMeta: LlmCallMeta = { model: 'm', provider: 'p', prompt: 'prompt' };
    const validResult: LlmCallResultLike = {
      text: 'answer',
      usage: { inputTokens: 1, outputTokens: 2 },
    };
    void validMeta;
    void validResult;

    // @ts-expect-error prompt is required to construct a valid llm_called event
    const missingPrompt: LlmCallMeta = { model: 'm', provider: 'p' };
    // @ts-expect-error usage is required to construct a valid llm_called event
    const missingUsage: LlmCallResultLike = { text: 'answer' };
    void missingPrompt;
    void missingUsage;
  });
});
