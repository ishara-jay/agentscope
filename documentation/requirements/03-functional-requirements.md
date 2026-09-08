# 03 — Functional & Non-Functional Requirements (MVP)

## Functional requirements

### FR-1 Trace capture

- FR-1.1 A TypeScript emitter helper exposes functions to record: `agent_started`, `llm_called`, `tool_called`, `delegated`, `agent_finished`.
- FR-1.2 Every event carries: `session_id`, `span_id`, `parent_span_id` (nullable for root), timestamp, and event-specific payload (model, prompt, response, token counts, tool name, tool args/result, latency).
- FR-1.3 Field naming is **mapped to** OTel GenAI semantic conventions where an equivalent exists — plain snake_case keys (`model`, `input_tokens`) with the mapping table kept in the contract package (`packages/contract/src/events.ts`); the literal dotted attribute names (`gen_ai.request.model`) arrive only with OTLP ingestion (v1.2), translated at the edge. _(Amended at contract freeze, 2026-09-08 — dotted keys are hostile to TS ergonomics; see design 02 §2.)_
- FR-1.4 The emitter POSTs events to the ingest API; emission failures must not crash or block the agent run (fire-and-forget with local warning).

### FR-2 Ingest & storage

- FR-2.1 NestJS ingest endpoint accepts single events and small batches, validates against the schema, persists to Postgres.
- FR-2.2 Ingest is append-only; no updates to stored events.
- FR-2.3 Invalid events are rejected with a 4xx and a reason; valid events in a mixed batch are still stored.

### FR-3 Graph reconstruction

- FR-3.1 `GET /sessions` lists sessions (id, started_at, status, total cost/tokens, root agent name).
- FR-3.2 `GET /sessions/:id/graph` returns the conversation DAG: nodes (agent invocations, tool calls, LLM calls) and edges (parent/child, delegation), each node annotated with latency, tokens, and cost.
- FR-3.3 Cost is computed at **read time** from stored token counts — dollar amounts are never stored (see DD-8). Prices come from a JSON price file (per-model input/output token prices), keyed by model ID. The file path is set by env var and the file is read at runtime (mounted via docker-compose), so prices can be changed without a rebuild — and because cost is derived on read, a price change automatically re-prices past sessions too.
- FR-3.3.1 An unknown model ID must never break anything: its cost shows as "unknown" in the API and UI, token counts still display, and rollups mark totals as partial. No guessing, no crash (same spirit as FR-3.6). Editing prices through an API/UI is roadmap, not MVP.
- FR-3.4 Cost/token totals are rolled up per subtree and per session.
- FR-3.5 Reconstruction is a parent-pointer walk; the API also returns the flat, time-ordered event list for the session (drives the event-list panel).
- FR-3.6 Bad streams must not break the graph. The server checks each event on its own (shape and fields), but it does not fix broken sequences — that is the sender's job. If a sequence is broken anyway, reconstruction degrades gracefully instead of crashing: an event whose parent never arrived is shown under a synthetic "unattached" node, and a session with no finish event just shows as "running". Nothing more — no buffering, no reordering, no guessing (that is v1.2, see the roadmap).

### FR-4 UI

- FR-4.1 Session list page: sessions with status and totals; clicking opens the session view.
- FR-4.2 Session view: DAG rendered with React Flow (dagre/elkjs layout), nodes badged with latency and cost; distinct visual types for agent / tool / LLM-call nodes.
- FR-4.3 While a session is running, the UI polls every 2s and the graph grows live.
- FR-4.4 Clicking a node opens a detail panel: exact prompt, response, tool args/result, token counts, cost, timing.
- FR-4.5 Ordered event list shown alongside the graph; selecting an event highlights its node.

### FR-5 Demo application

- FR-5.1 A runnable multi-agent demo: orchestrator delegates to researcher and writer agents; researcher uses 2–3 tools; a hand-rolled agent loop (no agent-framework abstractions — see DD-7).
- FR-5.2 Fully instrumented with the emitter helper, wrapped at the `LlmClient` boundary.
- FR-5.3 Triggerable from the UI ("run demo task" button) or CLI.
- FR-5.4 Model access goes only through a minimal `LlmClient` port (`generate(messages, tools) → {text?, toolCalls?, usage}`); provider selected via `LLM_PROVIDER` env var. MVP ships one adapter: google-genai / Gemini (free-tier key). See DD-6.

## Non-functional requirements

- NFR-1 **One-command boot**: `docker compose up` starts Postgres, backend, frontend, and demo-agent runner.
- NFR-2 **Contract-first**: event schema and graph API response shape are frozen on Day 1 morning and captured as `fixture.json` (one complete fake session) so frontend and backend develop in parallel. Each shape is defined once as a Zod schema in a shared contract package; emitter types are inferred from it, the server runs the single authoritative runtime validation against it, and CI validates `fixture.json` against it (see DD-5).
- NFR-3 **Readability over generality**: this is a reference implementation; prefer the simple obvious design and document trade-offs in the README design-decisions section.
- NFR-4 Demo session scale: graphs up to ~50 nodes render smoothly; no pagination or virtualization needed in v1.
- NFR-5 Secrets: the google-genai API key comes from env only; never stored or logged; a `.env.example` is provided.
- NFR-6 CI (GitHub Actions): lint + typecheck + unit tests on the graph-reconstruction and cost-rollup logic (the two pieces with real logic).
