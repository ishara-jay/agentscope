# E1/E2 feature build plan

How to build the write and read paths after E0 scaffolding. Each numbered step
is one small PR with one owner and one cross-reviewer. E1 and E2 run in parallel,
but meet at explicit integration checkpoints instead of waiting for one large
merge at the end.

This plan implements the existing requirements; it does not add product scope.
The canonical behaviors remain in [FR-1 through FR-5](../requirements/README.md),
and the wire shapes remain in `@agentscope/contract`.

## Starting point

E0 provides:

- the frozen event, ingest-response, session, graph, and price schemas;
- the canonical 13-event fixture;
- transparent emitter wrappers whose event creation and transport are still
  stubs;
- the append-only PostgreSQL events table and database connection;
- the deterministic fake three-agent workflow;
- the backend, frontend, and Compose scaffolds.

The frontend currently renders only its scaffold. Rendering the canonical
fixture is therefore an early E2 step rather than an E0 assumption.

## Boundaries that stay fixed

- `packages/contract` owns every wire shape. Consumers infer types from its Zod
  schemas.
- The emitter never fails or changes the result of wrapped agent work.
- The backend validates at the HTTP edge and is the only runtime contract
  validator on the write path.
- The emitter assigns event time at the producer. Ingest preserves that
  timestamp; `received_at` and the internal ingestion order describe storage,
  not when the traced work happened.
- Events and token counts are append-only facts. Cost is derived from the
  runtime price file on every read.
- Captured prompt, response, and tool content is preserved without field-level
  truncation so the detail view can show the exact recorded values.
- Provider SDK types stop inside the provider adapter.
- The browser renders the graph returned by the backend; it does not reconstruct
  spans or calculate cost.
- A feature PR updates only its affected requirement file, the requirement index
  when status changes, and any public documentation whose shipped behavior
  changed. Planned behavior stays labeled as planned until evidence exists.

## Dependency map

```text
Joint contract review
        │
        ├── E1.1 event-producing wrappers ──▶ E1.2 batching/transport ──┐
        ├── E1.3 ingest/storage ────────────────────────────────────────┤
        │                                                               ├──▶ E1.4 instrumented demo
        │                                                               │         └──▶ E1.5 Gemini adapter
        │                                                               │
        ├── E2.1 pricing ──▶ E2.2 reconstruction ──▶ E2.3 read APIs ───┤
        │                                                               │
        └── E2.4 fixture UI ──▶ E2.5 API/session UI ──▶ E2.6 graph UI ─┘
                                                                    │
                                                                    └──▶ E2.7 polling/performance
```

E1.1, E1.3, E2.1, and E2.4 can start after the joint review. E2 does not wait
for live ingest: reconstruction uses the canonical fixture, and the read API can
be exercised with fixture rows. Live producer-to-browser verification happens at
the checkpoints below.

## Joint contract review

Timebox this review before the first feature PR. Contract changes require both
owners and fixture compatibility review.

Settle the two open seams:

1. **Observable LLM content.** Add `prompt` to `LlmCallMeta`; extend
   `LlmCallResultLike` with the normalized response fields needed to produce the
   required response string. The demo supplies a deterministic serialization of
   its `LlmRequest`. Text responses remain text; tool-call responses serialize
   the normalized tool calls. An agent callback's string result becomes
   `agent_finished.payload.output`.
2. **Single and batch ingest.** Add a canonical request schema/type covering one
   `TraceEvent` or `{ events: TraceEvent[] }`. The emitter continues to send
   batches. The backend inspects batch members individually so a mixed batch can
   accept valid events and report invalid members. A malformed outer request,
   empty batch, or batch over 100 receives `400`; a structurally valid mixed
   batch receives `202` with `accepted`, `duplicates`, and `rejected`.

Do not change the five event payloads or read response shapes unless this review
finds a demonstrated blocker. Any contract edit updates its tests and preserves
the canonical fixture in the same PR.

## E1 — Write path

Owner: Dev A. Dev B cross-reviews every PR.

### E1.1 — Event-producing emitter wrappers

Implement the behavior behind the existing wrap-style API:

- generate one session ID plus unique event and span IDs;
- stamp `agent_started` immediately before its callback and `agent_finished`
  immediately after the callback settles;
- stamp `delegated` immediately before the child agent starts;
- stamp `llm_called` and `tool_called` when their callbacks settle; these are
  completion events whose start time is derived as `timestamp - duration_ms`;
- use a wall-clock UTC source for event timestamps and a monotonic clock for
  LLM/tool durations so system-clock changes cannot produce negative timings;
- emit `agent_started` and exactly one `agent_finished`, including on errors;
- emit `delegated` on the parent before starting the child agent span;
- capture prompts, normalized responses, tool arguments/results, token usage,
  output, and safe error messages;
- preserve callback return values and thrown error identity.

Keep event construction separate from delivery so tests can use a deterministic
clock, ID source, and in-memory transport without exposing test concerns in the
wire contract.

**Done when:** focused tests prove all five event types, parent relationships,
timestamp placement, monotonic duration measurement, success/error completion,
complete content capture, and wrapper transparency. This completes the first
remaining FR-1 acceptance item.

### E1.2 — Bounded batching and HTTP transport

Implement DD-11's queue:

- post `IngestBatch` JSON to `{endpoint}/events`;
- flush when the queue reaches roughly 10 events, the oldest event reaches about
  300 ms, or `session.flush()` is called;
- never send more than 100 events in one request;
- keep timers inactive while the queue is empty;
- bound request time and retries so telemetry cannot hold the agent process
  indefinitely;
- honor `onError: 'warn' | 'silent'` without rejecting wrapped agent work;
- make `flush()` resolve after queued batches are delivered or deliberately
  given up.

**Done when:** fake-timer/fake-fetch tests cover size, time, and explicit flush;
batch bounds; server rejection/network failure; warning vs silence; and agent
completion despite transport failure. This completes FR-1's remaining batching
and failure evidence.

### E1.3 — Ingest endpoint and append-only persistence

Add a Nest `ingest` module with controller, service, and focused repository
boundary:

- accept one event or a 1–100 event batch at `POST /events`;
- validate every candidate with the shared `TraceEvent` schema;
- add an internal `ingest_order BIGSERIAL` column and replace the session index
  with `(session_id, timestamp, ingest_order)`; this is storage metadata, not a
  field in the public event contract;
- preserve the producer's `timestamp`, let PostgreSQL assign `received_at` and
  `ingest_order`, and store each valid event as its own append-only row;
- persist all valid members of one request with one multi-row `INSERT`, not one
  SQL statement or transaction per event;
- use `ON CONFLICT (event_id) DO NOTHING` for idempotency;
- return `202 IngestResponse` with stable input indexes for rejections;
- return `400` only when the outer request cannot be processed under the joint
  contract rule above.

PostgreSQL maintains both B-tree indexes incrementally for each inserted row; it
does not rebuild either index after an append. Batching removes repeated HTTP,
transaction, and statement overhead even though each stored row still receives
its own index entries.

Tests may replace the repository for HTTP edge cases. A separate PostgreSQL
integration test must prove accepted rows round-trip without mutation,
duplicate IDs are not inserted twice, and ingestion order increases across
single- and multi-event requests.

**Done when:** tests cover a valid single event, valid batch, mixed-validity
batch, duplicate IDs, malformed body, empty batch, oversized batch, multi-row
persistence, deterministic ingestion order, and stored event fidelity. Update
the HTTP API documentation and FR-2 evidence in this PR.

### Integration checkpoint A — durable fake trace

After E1.2 and E1.3 merge, run the deterministic demo through the real emitter
and ingest endpoint. Query PostgreSQL and confirm that one complete session is
present with valid parent pointers and no duplicate event IDs. Fix write-path
issues before adding the provider adapter.

### E1.4 — Complete demo instrumentation

Route every agent, model call, tool call, and delegation through the implemented
emitter:

- centralize LLM instrumentation so every `LlmClient.generate` call records the
  same prompt/response representation;
- resolve the model from run configuration rather than hard-coding
  `fake-model` at each agent call site;
- keep fake runs deterministic and network-free;
- flush on CLI success and failure;
- never put environment values or credentials in events or errors.

**Done when:** an automated fake demo run produces a complete session that
parses as trace events and contains the orchestrator, researcher, writer, two
tools, all LLM calls, and correct nesting. This completes FR-5's emitter-session
evidence.

### E1.5 — Gemini `LlmClient` adapter

Add the one MVP provider adapter:

- select it with `LLM_PROVIDER=gemini` while preserving `fake` as the default;
- read `GEMINI_API_KEY` only from the environment and fail clearly when absent;
- keep google-genai request/response types inside `llm/gemini.ts`;
- normalize text, function calls, and usage into `LlmResult`;
- use a configured/default Gemini model that also appears in `prices.json`;
- redact credentials and provider request metadata from errors, logs, and
  telemetry.

Unit tests mock the SDK boundary and never use the public network. A real-key
CLI smoke run is manual and is never required in CI.

**Done when:** fake and Gemini selection tests pass, normalized text/tool-call
responses and usage are covered, missing-key behavior is safe, and a manually
authorized Gemini run produces a complete persisted session. Update FR-5,
NFR-5, `.env.example`, and public setup docs with evidence actually obtained.

## E2 — Read path

Owner: Dev B. Dev A cross-reviews every PR. Pair on E2.2's reconstruction core
for the timeboxed session required by the delivery plan.

### E2.1 — Runtime pricing

Add a small backend price loader/calculator that:

- reads `PRICES_FILE` at request time so edits re-price historical sessions;
- validates with the shared `PriceTable` schema;
- calculates input/output cost from per-million-token prices;
- returns unknown cost without losing token totals for missing models;
- degrades a missing or malformed file to an empty price table with a local
  warning, never a failed graph response.

**Done when:** unit tests cover known, zero-cost, unknown, malformed, and missing
price entries plus partial rollups. No dollar amount is added to the database.

### E2.2 — Graph reconstruction core

Implement pure reconstruction over parsed `TraceEvent[]`. The caller supplies
events in ingestion order so a stable timestamp sort has a deterministic tie
break:

- sort source events by producer timestamp and retain incoming ingestion order
  when timestamps are equal;
- build agent nodes from start/finish pairs and completed LLM/tool nodes from
  their events;
- derive completion-call start time from event timestamp minus `duration_ms`;
- create containment edges and style agent-to-agent parentage as delegation;
- roll LLM tokens and derived cost into every ancestor agent and the session;
- keep unfinished agents/sessions `running`;
- place missing-parent spans under one deterministic synthetic `unattached`
  node;
- retain the ordered source events in `SessionGraph`.

Rows are re-parsed with `TraceEvent` before reconstruction. Invalid stored rows
are skipped and surfaced through a local warning rather than crashing reads.

**Done when:** tests cover the canonical fixture, nested delegation, exact
subtree/session totals, equal-timestamp ordering, an orphan, unfinished session,
error status, unknown model, partial cost, and an invalid stored row. Validate
the result with `SessionGraph` in tests.

### E2.3 — Session queries and read endpoints

Add a separate `sessions` module that does not import the ingest module:

- query session event rows with
  `ORDER BY timestamp ASC, ingest_order ASC`, using the matching composite
  index;
- derive the distinct session list without introducing a stored sessions table;
- serve `GET /sessions` with newest sessions first;
- serve `GET /sessions/:id/graph` through the reconstruction core;
- return `404` for an unknown session;
- validate test responses with `SessionList` and `SessionGraph`.

Avoid a stored sessions table or persisted rollups. Querying and reconstruction
remain read-time operations for the MVP.

**Done when:** focused endpoint tests cover list, graph, unknown ID, running and
terminal sessions, and contract validation. A PostgreSQL integration test loads
the canonical fixture and reads it through both endpoints. Update FR-3 and the
HTTP API documentation with the resulting evidence.

### Integration checkpoint B — fixture through both APIs

POST the canonical fixture through the ingest endpoint, then retrieve it through
both read endpoints. Confirm the response schemas, exact event count, graph
parentage, and price totals before the frontend switches from fixture data to
HTTP data.

### E2.4 — Fixture graph vertical slice

Build the browser's first complete vertical slice without a backend dependency:

- add Vitest, Testing Library, and a DOM test environment to the frontend;
- create a test/demo `SessionGraph` value with explicit nodes and edges while
  reusing the canonical source events; do not add browser reconstruction logic;
- use a maintained layout library such as Dagre or ELK rather than hand-written
  coordinates;
- render visually distinct agent, LLM, tool, and unattached nodes;
- show status, duration, token, and cost/partial-cost badges;
- verify the canonical fixture remains readable at common viewport sizes.

Delete the test/demo graph from the production path when E2.6 consumes the
backend response. Reconstruction never belongs in browser code.

**Done when:** the canonical fixture renders a selectable laid-out graph and
component tests distinguish every node kind.

### E2.5 — API client and session list

Add a typed browser API boundary using contract-inferred response types:

- fetch and parse `GET /sessions` and `GET /sessions/:id/graph`;
- configure Vite/nginx proxying without hard-coded container hostnames in UI
  code;
- render session status, start time, token totals, known/unknown cost, selection,
  loading, empty, and error states;
- open the selected session without a full-page navigation.

**Done when:** component tests cover list rendering and selection, and API tests
cover valid, malformed, empty, and failed responses.

### E2.6 — Graph details and ordered events

Replace fixture plumbing with the backend `SessionGraph` and complete the
inspection workflow:

- render server-provided nodes and edges without recomputing rollups;
- show exact prompt/response, tool arguments/result, agent input/output/error,
  tokens, cost, duration, and status in the detail panel;
- list source events in timestamp order beside the graph;
- selecting an event selects/highlights its node, while delegation events
  highlight the parent agent span;
- preserve selection when refreshed graph data still contains that span.

**Done when:** tests cover node selection, each detail shape, event-to-node
highlighting, partial/unknown cost, unattached nodes, and selection preservation.
Update FR-4 evidence only for checks now present.

### E2.7 — Polling and MVP graph-size check

- poll a running session every two seconds;
- stop polling as soon as the session becomes `success` or `error`;
- update graph data without a page refresh or duplicate React Flow elements;
- cancel stale requests when selection changes or the component unmounts;
- exercise a deterministic roughly 50-node graph and record the documented
  browser/development-machine result.

**Done when:** fake-timer tests prove polling cadence, terminal stop, and cleanup;
the 50-node graph remains responsive for pan, zoom, selection, and detail; and
FR-4/NFR-4 evidence reflects the checks performed.

## Integration checkpoint C — live fake run

With both tracks merged:

1. Start PostgreSQL, backend, and frontend with Compose.
2. Run the fake demo from the CLI against the backend.
3. Open the running session in the browser.
4. Verify nodes appear through two-second polling and stop refreshing when the
   root finishes.
5. Inspect one agent, one LLM call, and one tool call for exact details and
   rolled-up totals.
6. Restart the backend and confirm the stored session still reads identically.

Automate the stable portions as an integration test; retain one short manual UI
smoke check for layout and interaction.

## E1/E2 completion gate

E1 and E2 are complete when:

- FR-1 and FR-2 acceptance evidence is complete;
- the non-UI portions of FR-5 are complete, including one authorized real
  provider smoke run;
- FR-3 acceptance evidence is complete;
- FR-4.1 through FR-4.5 work against persisted sessions;
- NFR-4's 50-node check and the applicable NFR-5 secret checks are recorded;
- Integration checkpoint C passes; and
- the repository-wide gate passes from the root:

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

## Deferred to E3

The following are integration-and-shipping work, not hidden additions to either
feature track:

- a browser **Run demo task** action and its cross-service HTTP boundary;
- adding the demo runner to Compose and completing the clean-clone NFR-1 smoke
  test;
- the README architecture diagram, demo GIF, and final design-decision summary;
- final end-to-end polish and release evidence.

Do not begin roadmap features such as WebSockets, arbitrary OTLP ingestion,
search, authentication, replay, or additional provider adapters during E1/E2.
