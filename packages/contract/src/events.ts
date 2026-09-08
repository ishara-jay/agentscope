import { z } from 'zod';

/**
 * Trace event schemas — the wire contract for `POST /events`.
 *
 * Field naming (FR-1.3): plain snake_case keys, mapped to OTel GenAI semantic
 * conventions. The `↔` comments below are the mapping table; the literal dotted
 * attribute names (e.g. "gen_ai.request.model") arrive only with OTLP ingestion
 * (roadmap v1.2), translated to these fields at the edge.
 *
 * Span model (design 02 §1): agent spans emit a started/finished pair; LLM and
 * tool spans emit a single completion event carrying its own duration.
 */

/** Fields common to every event: who/where/when in the tree. */
export const Envelope = z.object({
  /** Producer-generated; the ingest idempotency key (DD-10). */
  event_id: z.uuid(),
  session_id: z.uuid(),
  span_id: z.string().min(1),
  /** Null only on the root agent span. */
  parent_span_id: z.string().min(1).nullable(),
  /** Producer clock, ISO 8601 UTC. */
  timestamp: z.iso.datetime(),
});

export const AgentStarted = Envelope.extend({
  type: z.literal('agent_started'),
  payload: z.object({
    agent_name: z.string().min(1),
    /** The task this agent was given. */
    input: z.string().optional(),
  }),
});

export const AgentFinished = Envelope.extend({
  type: z.literal('agent_finished'),
  payload: z.object({
    status: z.enum(['success', 'error']),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
});

export const LlmCalled = Envelope.extend({
  type: z.literal('llm_called'),
  payload: z.object({
    model: z.string().min(1), // ↔ gen_ai.request.model
    provider: z.string().min(1), // ↔ gen_ai.system
    input_tokens: z.number().int().nonnegative(), // ↔ gen_ai.usage.input_tokens
    output_tokens: z.number().int().nonnegative(), // ↔ gen_ai.usage.output_tokens
    duration_ms: z.number().nonnegative(),
    /** Capped at 16 KB by the emitter (truncated with a "…[truncated]" marker). */
    prompt: z.string(),
    response: z.string(),
  }),
});

export const ToolCalled = Envelope.extend({
  type: z.literal('tool_called'),
  payload: z.object({
    tool_name: z.string().min(1), // ↔ gen_ai.tool.name
    status: z.enum(['success', 'error']),
    /** JSON-serializable; capped like prompt. */
    args: z.unknown(),
    result: z.unknown(),
    duration_ms: z.number().nonnegative(),
  }),
});

/**
 * Emitted by the *parent* agent (on the parent's span_id) when it hands a task
 * to a child. Records what was asked; the child's own agent_started/finished
 * record the execution.
 */
export const Delegated = Envelope.extend({
  type: z.literal('delegated'),
  payload: z.object({
    child_agent_name: z.string().min(1),
    task: z.string(),
  }),
});

/** Any valid event — the workhorse validator (ingest, fixture CI, read-path re-parse). */
export const TraceEvent = z.discriminatedUnion('type', [
  AgentStarted,
  AgentFinished,
  LlmCalled,
  ToolCalled,
  Delegated,
]);
export type TraceEvent = z.infer<typeof TraceEvent>;
export type AgentStarted = z.infer<typeof AgentStarted>;
export type AgentFinished = z.infer<typeof AgentFinished>;
export type LlmCalled = z.infer<typeof LlmCalled>;
export type ToolCalled = z.infer<typeof ToolCalled>;
export type Delegated = z.infer<typeof Delegated>;

/** Request body of `POST /events`. Bounds 1–100 are contract (DD-11). */
export const IngestBatch = z.object({
  events: z.array(TraceEvent).min(1).max(100),
});
export type IngestBatch = z.infer<typeof IngestBatch>;

/** Response of `POST /events` (202): receipt, not visibility (design 02 §3). */
export const IngestResponse = z.object({
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  rejected: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      reason: z.string(),
    }),
  ),
});
export type IngestResponse = z.infer<typeof IngestResponse>;
