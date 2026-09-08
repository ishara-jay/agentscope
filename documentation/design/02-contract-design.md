# Design 02 — Contract Design (E0 steps 3–4: events, graph API, fixture, emitter)

The Day-1 pairing session reviews and freezes this document's schemas; after that, changes follow the working agreement (both devs + fixture in the same commit, DD-5).

---

## 1. Span model (the mental model everything hangs on)

- A **session** is one end-to-end run (one demo task). `session_id` groups everything.
- A **span** is one unit of work with a start and end: an *agent invocation*, an *LLM call*, or a *tool call*. Every span has a `span_id`; every span except the root has a `parent_span_id`.
- **Agent spans** are long-lived → they emit **two events** (`agent_started`, `agent_finished`) so the UI can live-draw running agents.
- **LLM and tool spans** are short-lived → they emit **one event on completion** (`llm_called`, `tool_called`) carrying their own duration. Sub-second live granularity isn't worth doubling the event count.
- **`delegated`** is emitted by the *parent* agent when it hands a task to a child, carrying the task description. The child's own `agent_started` follows with `parent_span_id` pointing at the delegating agent's span. (The delegation *edge* is derivable from parentage alone; the `delegated` event exists to capture **what was asked** — the task text — which belongs to the handoff, not to either span.)

```
session
└── agent span: orchestrator          agent_started ... agent_finished
    ├── llm span (plan)               llm_called
    ├── delegated → researcher        delegated
    ├── agent span: researcher        agent_started ... agent_finished
    │   ├── tool span (search)        tool_called
    │   └── llm span (summarize)      llm_called
    └── agent span: writer            ...
```

## 2. Event schema (Zod, in `packages/contract/src/events.ts`)

Common envelope + per-type payload (discriminated union on `type`):

```ts
const Envelope = z.object({
  event_id: z.string().uuid(),        // producer-generated; ingest idempotency key
  session_id: z.string().uuid(),
  span_id: z.string().min(1),
  parent_span_id: z.string().min(1).nullable(),
  timestamp: z.string().datetime(),   // producer clock, ISO 8601 UTC
});

export const AgentStarted = Envelope.extend({
  type: z.literal("agent_started"),
  payload: z.object({
    agent_name: z.string().min(1),
    input: z.string().optional(),         // the task this agent was given
  }),
});

export const AgentFinished = Envelope.extend({
  type: z.literal("agent_finished"),
  payload: z.object({
    status: z.enum(["success", "error"]),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
});

export const LlmCalled = Envelope.extend({
  type: z.literal("llm_called"),
  payload: z.object({
    model: z.string().min(1),             // ↔ gen_ai.request.model
    provider: z.string().min(1),          // ↔ gen_ai.system    e.g. "gemini" | "fake"
    input_tokens: z.number().int().nonnegative(),   // ↔ gen_ai.usage.input_tokens
    output_tokens: z.number().int().nonnegative(),  // ↔ gen_ai.usage.output_tokens
    latency_ms: z.number().nonnegative(),
    prompt: z.string(),                   // capped at 16 KB by the emitter (truncated + "…[truncated]")
    response: z.string(),                 // same cap
  }),
});

export const ToolCalled = Envelope.extend({
  type: z.literal("tool_called"),
  payload: z.object({
    tool_name: z.string().min(1),
    status: z.enum(["success", "error"]),
    args: z.unknown(),                    // JSON-serializable; capped like prompt
    result: z.unknown(),
    latency_ms: z.number().nonnegative(),
  }),
});

export const Delegated = Envelope.extend({
  type: z.literal("delegated"),
  payload: z.object({
    child_agent_name: z.string().min(1),
    task: z.string(),
  }),
});

export const TraceEvent = z.discriminatedUnion("type", [
  AgentStarted, AgentFinished, LlmCalled, ToolCalled, Delegated,
]);
export type TraceEvent = z.infer<typeof TraceEvent>;

export const IngestBatch = z.object({ events: z.array(TraceEvent).min(1).max(100) });
```

**Design refinement vs FR-1.3 (flagged for the pairing review):** we use plain snake_case keys with a documented mapping to OTel GenAI attribute names (shown as `↔` comments above) rather than literal dotted keys like `"gen_ai.request.model"` — dotted keys are miserable in TS (`payload["gen_ai.request.model"]`) and the literal attributes arrive naturally with OTLP ingest in v1.2, where the translation layer maps them to these fields. FR-1.3 should be softened to "mapped to OTel GenAI semantic conventions (mapping table in the contract)".

**Span rules (documented, enforced only by the emitter in v1 — broken streams degrade per FR-3.6):**
- Exactly one `agent_started` and at most one `agent_finished` per agent span.
- `llm_called` / `tool_called` spans have an agent span as parent.
- The root span is an agent span with `parent_span_id: null`.

## 3. Ingest API

```
POST /events
Body: IngestBatch          → 202 { accepted: n, duplicates: m, rejected: [{index, reason}] }
```

- Valid events in a mixed batch are stored; invalid ones come back in `rejected` with a reason (FR-2.3).
- Duplicate `event_id`s are counted, not errors (`ON CONFLICT DO NOTHING` — safe emitter retries).
- 202, not 201: ingest acknowledges receipt; graph effects are eventually visible via polling.

## 4. Read API (`GET /sessions`, `GET /sessions/:id/graph`)

```ts
// GET /sessions → { sessions: SessionSummary[] }
export const SessionSummary = z.object({
  session_id: z.string().uuid(),
  root_agent: z.string().nullable(),       // null if the root's agent_started is missing
  status: z.enum(["running", "success", "error"]),   // no terminal event ⇒ "running" (FR-3.6)
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  totals: Totals,
});

const Totals = z.object({
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  cost_usd: z.number().nullable(),         // null when no priced calls at all
  cost_is_partial: z.boolean(),            // true if any model was missing from the price file (FR-3.3.1)
});

// GET /sessions/:id/graph → SessionGraph
export const GraphNode = z.object({
  span_id: z.string(),
  kind: z.enum(["agent", "llm_call", "tool_call", "unattached"]),  // "unattached": synthetic
  label: z.string(),                        // agent_name | model | tool_name
  status: z.enum(["running", "success", "error"]),
  started_at: z.string().datetime(),
  latency_ms: z.number().nullable(),        // null while running
  input_tokens: z.number().int().nullable(),   // llm_call nodes; agents carry subtree rollups
  output_tokens: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  cost_is_partial: z.boolean(),
  detail: z.unknown(),                      // full payload for the detail panel (FR-4.4)
});

export const GraphEdge = z.object({
  from: z.string(),                         // parent span_id
  to: z.string(),
  kind: z.enum(["contains", "delegation"]), // delegation = agent→agent (styled differently)
});

export const SessionGraph = z.object({
  session: SessionSummary,
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  events: z.array(TraceEvent),              // flat, time-ordered — drives the event-list panel (FR-3.5/4.5)
});
```

Reconstruction notes (Dev B's pairing session): build nodes from events keyed by `span_id`; parent pointers give `contains` edges; agent→agent parentage is styled as `delegation`; orphaned parents → children re-parented under one synthetic `unattached` node per session (FR-3.6); agent-node tokens/cost are **subtree rollups**, llm nodes carry their own.

## 5. Emitter API (`packages/emitter`) and `LlmClient` (DD-6)

```ts
// emitter — wrap-style API: spans can't be left open by accident
const session = startSession({ endpoint, onError: "warn" });   // fire-and-forget POSTs (FR-1.4)

await session.agent("orchestrator", { input: task }, async (span) => {
  const plan = await span.llmCall({ model, provider }, () => llm.generate(req));
      // measures latency, extracts usage from the LlmClient result, emits llm_called

  await span.toolCall("search", args, () => tools.search(args));

  await span.delegate("researcher", subtask, async (child) => { ... });
      // emits delegated on the parent + agent_started/finished around the child fn
});
await session.flush();    // drain the queue before process exit
```

Wrap-style (callback) rather than begin/end pairs: an unhandled throw still emits `agent_finished { status: "error" }`, and the current-span context needs no `AsyncLocalStorage` in v1 — the callback argument *is* the context.

```ts
// LlmClient — the provider port (demo-agents/src/llm/client.ts)
export interface LlmRequest {
  model: string;
  messages: { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }[];
  tools?: { name: string; description: string; parameters: JsonSchema }[];
}
export interface LlmResult {
  text?: string;
  toolCalls?: { id: string; name: string; args: unknown }[];
  usage: { inputTokens: number; outputTokens: number };
}
export interface LlmClient {
  readonly provider: string;                      // "gemini" | "fake" — flows into llm_called
  generate(req: LlmRequest): Promise<LlmResult>;
}
```

Deliberately minimal (DD-6): no streaming, no thinking/config passthrough. The tool-calling normalization (Gemini function-call shapes ↔ this interface) lives entirely inside `gemini.ts`.

## 6. `fixture.json` (shape sketch — full file is the step-3 deliverable)

One complete session: orchestrator plans (llm), delegates research (2 tool calls + 1 llm), delegates writing (1 llm), finishes. ~12 events, ~7 graph nodes — enough nesting, parallel branches, and token variety to exercise the whole UI.

```jsonc
{ "events": [
  { "type": "agent_started", "session_id": "…", "span_id": "sp-orch", "parent_span_id": null,
    "timestamp": "2026-09-08T09:00:00.000Z", "event_id": "…",
    "payload": { "agent_name": "orchestrator", "input": "Research and summarize X" } },
  { "type": "llm_called", "span_id": "sp-llm-1", "parent_span_id": "sp-orch",
    "payload": { "model": "fake-model", "provider": "fake", "input_tokens": 812,
                 "output_tokens": 156, "latency_ms": 1420, "prompt": "…", "response": "…" }, "…": "…" },
  { "type": "delegated", "span_id": "sp-orch", "payload": { "child_agent_name": "researcher", "task": "…" }, "…": "…" },
  { "type": "agent_started", "span_id": "sp-res", "parent_span_id": "sp-orch", "…": "…" },
  // … tool_called ×2, llm_called, agent_finished(researcher), writer branch, agent_finished(orchestrator)
] }
```

The contract package's Vitest test parses every fixture event with `TraceEvent` and asserts the span rules (§2) hold — the DD-5 CI check.

---

## Freeze checklist (Day-1 pairing, hour one)

1. Walk §1 span model — any disagreement here is the expensive kind, settle it first.
2. Review §2 field-by-field; accept or amend the FR-1.3 naming refinement.
3. Accept §3/§4 response shapes (Dev B: is `SessionGraph` renderable as-is? nodes/edges/events enough for React Flow + panels?).
4. Write the full `fixture.json` together against §6.
5. Merge step 3's PR; from then on, schema changes = both devs + fixture, same commit.
