import type { AgentStarted, LlmCalled } from '@agentscope/contract';

/**
 * Public types of the emitter (FR-1). Everything the demo app calls is typed
 * here; `session.ts` holds the implementations.
 *
 * Wrap-style API (design 02 §5): every span is a callback, so a span can't be
 * left open by accident, and the callback argument *is* the current-span
 * context — no AsyncLocalStorage in v1.
 *
 * Field types are derived from the contract (DD-5): the emitter can't drift
 * from the wire schema, and it never validates — the server is the only
 * runtime validator.
 */

export interface EmitterOptions {
  /** Ingest base URL (`POST {endpoint}/events`); from `AGENTSCOPE_ENDPOINT`. */
  endpoint: string;
  /**
   * What to do when emission fails. Never `'throw'`: emission failures must
   * not crash or block the agent run (FR-1.4). Default: `'warn'`.
   */
  onError?: 'warn' | 'silent';
}

/** What the agent was asked to do — the `agent_started` payload minus the name. */
export type AgentOptions = Pick<AgentStarted['payload'], 'input'>;

/** Which model answered — the `llm_called` fields the wrapper can't observe itself. */
export type LlmCallMeta = Pick<LlmCalled['payload'], 'model' | 'provider'>;

/**
 * The deliberate seam between the emitter and the demo app's `LlmClient`
 * (design 02 §5): shaped to match `LlmResult` so `llmCall` can read token
 * usage off whatever the wrapped call returns, without depending on the app.
 */
export interface LlmCallResultLike {
  usage: { inputTokens: number; outputTokens: number };
}

/** One end-to-end run. Created by `startSession`; groups every span under one `session_id`. */
export interface Session {
  /** Run `fn` as the root agent span: `agent_started` … `agent_finished` around it. */
  agent<T>(name: string, opts: AgentOptions, fn: (span: AgentSpan) => Promise<T>): Promise<T>;
  /** Drain the outgoing queue (DD-11). Call before process exit. */
  flush(): Promise<void>;
}

/** The context handed to an agent's callback: how the agent records what it does. */
export interface AgentSpan {
  /** Time `fn`, read usage off its result, emit `llm_called`. Returns the result untouched. */
  llmCall<T extends LlmCallResultLike>(meta: LlmCallMeta, fn: () => Promise<T>): Promise<T>;
  /** Time `fn`, emit `tool_called` with `args` and the result or error. Returns the result untouched. */
  toolCall<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T>;
  /** Emit `delegated` on this span, then run `fn` as the child agent span. */
  delegate<T>(childName: string, task: string, fn: (child: AgentSpan) => Promise<T>): Promise<T>;
}
