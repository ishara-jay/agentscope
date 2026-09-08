import type {
  AgentOptions,
  AgentSpan,
  EmitterOptions,
  LlmCallMeta,
  LlmCallResultLike,
  Session,
} from './types.js';

/**
 * B1 stubs: every wrapper runs its callback and returns the result untouched —
 * nothing is timed, queued, or sent. Each `// B1:` comment marks exactly what
 * E1 fills in. Nothing here validates events, now or later (DD-5).
 */

class AgentSpanImpl implements AgentSpan {
  async llmCall<T extends LlmCallResultLike>(_meta: LlmCallMeta, fn: () => Promise<T>): Promise<T> {
    // B1: time fn, read result.usage, emit llm_called on a fresh child span_id.
    return fn();
  }

  async toolCall<T>(_name: string, _args: unknown, fn: () => Promise<T>): Promise<T> {
    // B1: time fn, emit tool_called (status from return/throw) on a fresh child span_id.
    return fn();
  }

  async delegate<T>(
    _childName: string,
    _task: string,
    fn: (child: AgentSpan) => Promise<T>,
  ): Promise<T> {
    // B1: emit delegated on this span; agent_started/finished around fn on a child span.
    return fn(new AgentSpanImpl());
  }
}

class SessionImpl implements Session {
  constructor(private readonly _opts: EmitterOptions) {
    // B1: generate session_id; set up the queue and fire-and-forget POSTs (FR-1.4, DD-11).
  }

  async agent<T>(
    _name: string,
    _opts: AgentOptions,
    fn: (span: AgentSpan) => Promise<T>,
  ): Promise<T> {
    // B1: agent_started/finished (status from return/throw) around fn on the root span.
    return fn(new AgentSpanImpl());
  }

  async flush(): Promise<void> {
    // B1: drain the queue; resolve once the last batch is POSTed or given up on.
  }
}

/** Start one end-to-end run. Never throws on emission failure (FR-1.4). */
export function startSession(opts: EmitterOptions): Session {
  return new SessionImpl(opts);
}
