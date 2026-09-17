import type { TraceEvent } from '@agentscope/contract';
import type {
  AgentOptions,
  AgentSpan,
  EmitterOptions,
  LlmCallMeta,
  LlmCallResultLike,
  Session,
} from './types.js';

export interface EventDelivery {
  emit(event: TraceEvent): void;
  flush(): Promise<void>;
}

/** Internal dependencies. Exported from this module only for deterministic tests. */
export interface SessionRuntime {
  wallNow(): Date;
  monotonicNow(): number;
  newId(): string;
  delivery: EventDelivery;
  warn(message: string): void;
}

type SpanIdentity = {
  spanId: string;
  parentSpanId: string | null;
};

const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

const llmResponse = (result: LlmCallResultLike): string =>
  result.toolCalls !== undefined && result.toolCalls.length > 0
    ? JSON.stringify(result.toolCalls)
    : (result.text ?? '');

class AgentSpanImpl implements AgentSpan {
  constructor(
    private readonly session: SessionImpl,
    private readonly identity: SpanIdentity,
  ) {}

  async llmCall<T extends LlmCallResultLike>(meta: LlmCallMeta, fn: () => Promise<T>): Promise<T> {
    const spanId = this.session.newId();
    const startedAt = this.session.monotonicNow();

    const result = await fn();
    const durationMs = this.session.durationSince(startedAt);
    this.session.record(() => ({
      ...this.session.envelope({ spanId, parentSpanId: this.identity.spanId }),
      type: 'llm_called',
      payload: {
        model: meta.model,
        provider: meta.provider,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        duration_ms: durationMs,
        prompt: meta.prompt,
        response: llmResponse(result),
      },
    }));
    return result;
  }

  async toolCall<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T> {
    const spanId = this.session.newId();
    const startedAt = this.session.monotonicNow();

    try {
      const result = await fn();
      const durationMs = this.session.durationSince(startedAt);
      this.session.record(() => ({
        ...this.session.envelope({ spanId, parentSpanId: this.identity.spanId }),
        type: 'tool_called',
        payload: {
          tool_name: name,
          status: 'success',
          args,
          result,
          duration_ms: durationMs,
        },
      }));
      return result;
    } catch (error) {
      const durationMs = this.session.durationSince(startedAt);
      this.session.record(() => ({
        ...this.session.envelope({ spanId, parentSpanId: this.identity.spanId }),
        type: 'tool_called',
        payload: {
          tool_name: name,
          status: 'error',
          args,
          result: { error: safeErrorMessage(error) },
          duration_ms: durationMs,
        },
      }));
      throw error;
    }
  }

  async delegate<T>(
    childName: string,
    task: string,
    fn: (child: AgentSpan) => Promise<T>,
  ): Promise<T> {
    this.session.record(() => ({
      ...this.session.envelope(this.identity),
      type: 'delegated',
      payload: { child_agent_name: childName, task },
    }));
    return this.session.runAgent(childName, { input: task }, this.identity.spanId, fn);
  }
}

class SessionImpl implements Session {
  private readonly sessionId: string;

  constructor(
    private readonly opts: EmitterOptions,
    private readonly runtime: SessionRuntime,
  ) {
    this.sessionId = runtime.newId();
  }

  newId(): string {
    return this.runtime.newId();
  }

  monotonicNow(): number {
    return this.runtime.monotonicNow();
  }

  durationSince(startedAt: number): number {
    return Math.max(0, this.runtime.monotonicNow() - startedAt);
  }

  envelope(
    identity: SpanIdentity,
  ): Pick<TraceEvent, 'event_id' | 'session_id' | 'span_id' | 'parent_span_id' | 'timestamp'> {
    return {
      event_id: this.runtime.newId(),
      session_id: this.sessionId,
      span_id: identity.spanId,
      parent_span_id: identity.parentSpanId,
      timestamp: this.runtime.wallNow().toISOString(),
    };
  }

  record(createEvent: () => TraceEvent): void {
    try {
      this.runtime.delivery.emit(createEvent());
    } catch {
      this.reportFailure();
    }
  }

  private reportFailure(): void {
    if (this.opts.onError === 'silent') return;
    try {
      this.runtime.warn('[agentscope] telemetry emission failed');
    } catch {
      // A warning is telemetry too: it must never alter the wrapped work.
    }
  }

  async agent<T>(
    name: string,
    opts: AgentOptions,
    fn: (span: AgentSpan) => Promise<T>,
  ): Promise<T> {
    return this.runAgent(name, opts, null, fn);
  }

  async runAgent<T>(
    name: string,
    opts: AgentOptions,
    parentSpanId: string | null,
    fn: (span: AgentSpan) => Promise<T>,
  ): Promise<T> {
    const identity = { spanId: this.runtime.newId(), parentSpanId };
    this.record(() => ({
      ...this.envelope(identity),
      type: 'agent_started',
      payload: {
        agent_name: name,
        ...(opts.input === undefined ? {} : { input: opts.input }),
      },
    }));

    try {
      const result = await fn(new AgentSpanImpl(this, identity));
      this.record(() => ({
        ...this.envelope(identity),
        type: 'agent_finished',
        payload: {
          status: 'success',
          ...(typeof result === 'string' ? { output: result } : {}),
        },
      }));
      return result;
    } catch (error) {
      this.record(() => ({
        ...this.envelope(identity),
        type: 'agent_finished',
        payload: { status: 'error', error: safeErrorMessage(error) },
      }));
      throw error;
    }
  }

  async flush(): Promise<void> {
    try {
      await this.runtime.delivery.flush();
    } catch {
      this.reportFailure();
    }
  }
}

/** Internal constructor used by focused tests and, in E1.2, the transport adapter. */
export function createSession(opts: EmitterOptions, runtime: SessionRuntime): Session {
  return new SessionImpl(opts, runtime);
}

const noOpDelivery: EventDelivery = {
  emit: () => undefined,
  flush: () => Promise.resolve(),
};

/** Start one end-to-end run. Never throws on emission failure (FR-1.4). */
export function startSession(opts: EmitterOptions): Session {
  return createSession(opts, {
    wallNow: () => new Date(),
    monotonicNow: () => performance.now(),
    newId: () => crypto.randomUUID(),
    delivery: noOpDelivery,
    warn: (message) => console.warn(message),
  });
}
