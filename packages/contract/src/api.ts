import { z } from 'zod';
import { TraceEvent } from './events.js';

/**
 * Read-API schemas — the shapes served by `GET /sessions` and
 * `GET /sessions/:id/graph` (design 02 §4). Cost fields follow DD-8:
 * dollars are derived at read time from stored tokens, never stored.
 */

export const Totals = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  /** Null when no call could be priced at all. */
  cost_usd: z.number().nullable(),
  /** True if any model was missing from the price file (FR-3.3.1). */
  cost_is_partial: z.boolean(),
});
export type Totals = z.infer<typeof Totals>;

export const SessionSummary = z.object({
  session_id: z.uuid(),
  /** Null if the root span's agent_started is missing (FR-3.6). */
  root_agent: z.string().nullable(),
  /** No terminal event ⇒ "running" (FR-3.6). */
  status: z.enum(['running', 'success', 'error']),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime().nullable(),
  totals: Totals,
});
export type SessionSummary = z.infer<typeof SessionSummary>;

export const GraphNode = z.object({
  span_id: z.string().min(1),
  /** "unattached" = synthetic parent for orphaned spans (FR-3.6). */
  kind: z.enum(['agent', 'llm_call', 'tool_call', 'unattached']),
  /** agent_name | model | tool_name. */
  label: z.string(),
  status: z.enum(['running', 'success', 'error']),
  started_at: z.iso.datetime(),
  /** Null while running. */
  duration_ms: z.number().nonnegative().nullable(),
  /** llm_call nodes carry their own; agent nodes carry subtree rollups. */
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().nullable(),
  cost_is_partial: z.boolean(),
  /** Full payload for the detail panel (FR-4.4). */
  detail: z.unknown(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  /** Parent span_id. */
  from: z.string().min(1),
  to: z.string().min(1),
  /** "delegation" = agent→agent (styled differently in the UI). */
  kind: z.enum(['contains', 'delegation']),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const SessionGraph = z.object({
  session: SessionSummary,
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  /** Flat, time-ordered — drives the event-list panel (FR-3.5 / FR-4.5). */
  events: z.array(TraceEvent),
});
export type SessionGraph = z.infer<typeof SessionGraph>;

export const SessionList = z.object({
  sessions: z.array(SessionSummary),
});
export type SessionList = z.infer<typeof SessionList>;
