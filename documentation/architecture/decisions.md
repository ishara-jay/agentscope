# Architecture decision log

Accepted cross-cutting decisions, the alternatives considered, and the
conditions under which each should be revisited. Unless an entry says otherwise,
its status is **Accepted**.

New decisions receive the next `DD-n` identifier. If direction changes, add the
replacement entry and mark the old one `Superseded by DD-n`; do not rewrite the
original rationale. This keeps decision-only edits small and preserves history.

---

## DD-1: NestJS over bare Express

**Decision:** Backend is NestJS (running on its default Express adapter — this is a structure decision, not a performance one).

**Why:**

- Validation at the ingest boundary is a named requirement (FR-2.1/2.3); Nest's pipe-based validation makes it nearly declarative, where Express would mean hand-rolling middleware, error shapes, and partial-batch handling (~half a day of the code most likely to be sloppy under time pressure).
- Structure by convention: two developers working in parallel for 3 days should not spend time agreeing on file layout. Nest's modules/controllers/providers make Dev A's ingest code and graph code look the same without a conversation.
- DI makes the two services with real logic (graph reconstruction, cost rollups) trivially unit-testable.
- Team fluency and portfolio continuity: NestJS is the stack we claim; Day 1 is not the time to learn a framework's opinions.

**What Express would have bought:** less ceremony, smaller dependency tree, marginally faster start for two endpoints. Right call for a solo one-endpoint hack; wrong call for a parallel two-person build with validation requirements.

**Honest caveat (goes in the README):** for a service this small, Nest is arguably more framework than the problem needs; it was chosen for validation, structure, testability, and team fluency — not by reflex.

---

## DD-2: JSON internally; protobuf only at the (future) standard boundary

**Decision:** The event contract, wire format, storage payloads (Postgres `jsonb`), and API responses are JSON. No protobuf/gRPC in v1.

**Why:**

- Contract-first is orthogonal to serialization: the discipline is "schema frozen on Day 1, one canonical definition" — Zod expresses that as well as `.proto` does.
- Every consumer in the pipeline is JSON-native: the browser UI (gRPC in browsers needs a grpc-web proxy), Postgres `jsonb` (queryable in place), and LLM prompt/response payloads which are JSON-shaped already.
- Human-readability is load-bearing, not a nicety: the parallel-track plan hangs on `fixture.json` being hand-readable/editable, and debugging being `curl` + devtools.
- Protobuf's real strengths don't apply at our scale or shape: multi-language codegen (we're single-language TS — a shared types package already enforces the contract), compact wire size (sessions are ~50 nodes), schema-evolution discipline (v0, one producer we own).

**Where protobuf enters anyway:** OTLP — OpenTelemetry's wire protocol — is protobuf-based. The v1.2 "true OTel ingestion" roadmap item is the moment protobuf naturally arrives: accepted at the ingest edge, normalized into internal JSON events. Each format where its strengths apply: protobuf at the machine-to-machine boundary the standard defines, JSON everywhere humans and browsers live.

---

## DD-3: A typed emitter helper, not raw HTTP calls from the demo app

**Decision:** The demo app instruments via a ~100-line TypeScript emitter helper; it never hand-builds event JSON.

**Why:**

- **Correlation bookkeeping must be centralized.** Events form a tree; every event needs the correct `parent_span_id`. That context ("what span am I inside?") exists only in the producer's process — the emitter owns it (span stack / `AsyncLocalStorage`), generates IDs, stamps parents, measures durations. This is what makes structural cut #1 ("events arrive well-formed, reconstruction is a parent-pointer walk") true — the emitter is how we own the client end of the wire.
- **Instrumentation must be one line or it rots.** ~A dozen instrumentation points across three agents; the 15-lines-of-boilerplate version is the version where instrumentation gets skipped by Day 2, and unskipped spans are holes in the demo graph.
- **The never-break-the-agent policy (FR-1.4) needs one home.** Fire-and-forget, timeout, swallow, warn — implemented once in the emitter, guaranteed everywhere.
- **Compile errors beat runtime 400s.** Emitter signatures are typed from the shared schema; malformed construction cannot compile.

**Mental model:** the standard two-layer shape of telemetry systems — a wire protocol for interoperability plus a client SDK for correct-by-construction usage (OTel has OTLP _and_ SDKs; nobody hand-crafts OTLP). The HTTP endpoint is the contract; the emitter is the paved road onto it.

---

## DD-4: Language-agnostic protocol; TypeScript-only paved road; never a per-language SDK family

**Decision:** The ingest protocol is plain JSON over HTTP and accepts any client in any language. First-party instrumentation support is TypeScript-only in v1. AgentScope will never ship per-language emitters.

**Why:**

- In-process context propagation is required by every tracing system (parentage can't be reconstructed server-side), which historically forced observability vendors onto the N-language-SDK treadmill. OpenTelemetry exists precisely to end that: apps instrument once with OTel SDKs, exporting standard OTLP to any backend.
- Our polyglot story is therefore **v1.2 OTel ingestion**, not emitter ports: OTel's SDKs become our "emitter" in every language, and we consume their standard output. This is why v1 field names are deliberately aligned with OTel GenAI semantic conventions — convergence later is a mapping exercise, not a redesign.
- Raw-HTTP integration remains possible today for any language (documented JSON, server rejects with reasons per FR-2.3) — the integrator just takes on their own span bookkeeping.
- In v1 the distinction is theoretical: the only producer that exists is our own TS demo app.

**Not a contradiction with the v1.2 cut — two different jobs:**

- Checking **one event at a time** (right fields, right types) is cheap. The server does this for every sender, always. Being "open to any client" only means this door is open.
- Making sense of a **whole stream of events** from someone else's app (events arriving in the wrong order, spans with missing parents, sessions that never end, other frameworks naming things differently) is the expensive part. That is what we cut to v1.2.
- Rule of thumb: **v1 checks events; the sender keeps their stream in order. v1.2 is when we start fixing other people's streams for them.** If a broken stream arrives anyway, the graph degrades gracefully instead of crashing (FR-3.6) — it does not get repaired.

---

## DD-5: One contract definition; duplicated enforcement, never duplicated definitions

**Decision:** Each event type and API response shape is defined **once**, as a Zod schema in a shared contract package. All enforcement derives from that single definition.

```
packages/contract  ← the ONE definition (Zod)
  ├─▶ emitter: z.infer<> static types            (compile-time, zero runtime cost)
  ├─▶ server:  schema.parse() in a Nest pipe     (the one authoritative runtime validator)
  └─▶ CI:      fixture.json validated against it (contract and fixture cannot drift)
```

**Why:**

- Server-side validation is non-negotiable regardless of the emitter ("never trust the client" — any HTTP client can send anything). Client-side checks exist for developer experience (compile-time errors at the call site). Two checkpoints with two different jobs — enforcement duplication is deliberate.
- The failure mode to prevent is two _definitions_ (emitter interfaces vs server DTOs) drifting apart. One Zod schema consumed everywhere makes drift impossible: a field added to the schema propagates to emitter types, server validation, and the fixture CI check in the same commit, or the build breaks.
- The emitter runs no runtime validation of its own — since we own it and it is typed from the same schema, there is exactly one runtime validator (the server).
- This is the general "one canonical contract artifact" pattern; polyglot shops implement it as one `.proto` + codegen. What varies is the derivation mechanism, not the invariant.

---

## DD-6: Provider-agnostic demo app via an `LlmClient` port; Gemini free tier for the MVP

**Decision:** The demo agents call models only through a minimal `LlmClient` interface (`generate(messages, tools) → {text?, toolCalls?, usage}`), with provider selected by config (`LLM_PROVIDER`). The MVP ships **one adapter: google-genai / Gemini** (free-tier API key). An Anthropic-SDK adapter is a Day-3-buffer stretch goal / roadmap item.

**Why:**

- **Provider-agnostic at the LLM-call layer only** — not at the agent-framework layer. Abstracting frameworks (LangGraph, Agent SDK, etc.) is per-framework adapter work already parked behind OTel ingest (v1.2). Explicit non-goal for the MVP.
- **Instrumentation lives at the seam, once.** The emitter wraps the `LlmClient` boundary, so every `llm_called` event is captured in one place and any future adapter is traced for free.
- **It proves the pitch** — "AgentScope's tracing is provider-neutral" becomes a demo (flip an env var), not a claim.
- **Credentials/billing reality:** a claude.ai/Claude Code subscription does not include Messages API credits (separate pay-as-you-go billing), and the google-genai SDK only talks to Gemini — the two don't combine. Gemini's free tier is plenty at demo scale with zero billing setup; the Anthropic adapter, when added, needs Console API credits (trivial cost at demo scale, but a prerequisite).
- The cost table is keyed by model ID, so providers coexist without changes.
- The only real adapter cost is normalizing tool-calling shapes (genai function calls vs Anthropic `tool_use` blocks) — which is why the interface stays minimal: no streaming, no thinking config, no provider-specific options in v1.

---

## DD-7: Hand-rolled agent loop in the demo app

**Decision:** The demo app implements its own small agent loop (delegation, tool dispatch — ~100 lines) rather than using any SDK's higher-level agent abstractions.

**Why:** the SDKs are used as dumb model clients behind the `LlmClient` port, which is what makes DD-6 cheap; a hand-rolled loop gives clean, unambiguous instrumentation points for the emitter; and the loop's simplicity keeps the demo's delegation shape stable for reliable demo runs.

---

## DD-8: Store facts (tokens), derive dollars at read time

**Decision:** Events store token counts and the model ID — never a dollar amount. Cost is computed when the graph is read, using a runtime-loaded JSON price file (path set by env var, mounted via docker-compose, editable without a rebuild).

**Why, in simple terms:**

- Token counts are **facts** — they came from the provider and never change. Prices are **opinions that change** — new models ship, prices move. Storing a computed dollar amount freezes today's opinion into the record; deriving it at read time means updating the price file automatically re-prices every past session correctly.
- Senders can put any model ID in an event, including ones we've never heard of. An unknown model shows cost as "unknown" (tokens still shown, rollups marked partial) instead of crashing or guessing (FR-3.3.1) — same posture as broken streams (FR-3.6).
- A runtime-editable **file** covers the MVP need (add a line when a model ships). An API/UI to edit prices is deferred to the roadmap — it's an endpoint, validation, and screen the 3-day budget doesn't have, for the same outcome this week.

---

## DD-9: pnpm workspaces for the monorepo

**Decision:** The monorepo uses pnpm workspaces (via `corepack enable`). No build orchestrator (Turborepo/Nx) on top — plain recursive pnpm scripts.

**Main reason — it makes our dependency rule physical:**

- npm (and classic yarn) hoist all dependencies into one flat `node_modules`. Side effect: any package can import anything installed anywhere in the repo, declared or not — "phantom dependencies." They work on your machine until someone reshuffles packages, then break in ways nobody understands.
- pnpm doesn't hoist: each package can only resolve what its own `package.json` declares. Our dependency-direction rule (`demo-agents → emitter → contract ← backend`, `frontend → contract`, arrows only downward, nothing depends on an app) stops being a diagram in the [monorepo build plan](build-plan.md) and becomes a build error when violated. For a two-person, 3-day build where cross-review is the only other guardrail, architecture enforcement for free from the package manager is a good trade.

**Supporting reasons:**

- Workspace ergonomics we already lean on: `pnpm --filter <pkg>` targeting (used in every E0 "done when" check) and `workspace:*` linking between internal packages with zero publishing ceremony.
- Speed and disk: one global content-addressed store, hard-linked into projects — fast installs, efficient CI caching.
- It's the current default for TS monorepos, so guides, templates, and AI-generated snippets mostly assume it — less friction on edge cases mid-sprint.

**Honest costs:** one-time `corepack enable`; rarely, a tool that assumes a flat hoisted `node_modules` misbehaves under the symlink layout (Nest, Vite, Drizzle, and React Flow are all fine).

**Alternatives:** npm workspaces — works, but hoists by default, losing the strictness that is the main point; acceptable fallback. Yarn Berry PnP — stricter still, but real ecosystem friction; more tool than five packages need.

---

## DD-10: PostgreSQL as the event store

**Decision:** Events are stored in PostgreSQL — one append-only table: envelope fields as indexed columns, the per-type payload as one `jsonb` column. Access via Drizzle.

**Main reason — the table is half relational, half document, and Postgres is excellent at both:**

- The envelope needs classic SQL: an ordered index scan per session (`(session_id, timestamp)`), idempotent writes (`ON CONFLICT (event_id) DO NOTHING` for safe emitter retries), transactional batch inserts, and `GROUP BY` to derive the sessions list.
- The payload needs document storage: five event types with different shapes in one column — which is exactly `jsonb` (validated binary JSON, queryable and indexable later without schema changes).
- Most databases force a side; Postgres does both natively, which is why the single-table design (envelope → columns, payload → jsonb) maps so cleanly.

**Supporting reasons:**

- Covers the roadmap with no new infrastructure: analytics → materialized views; replacing 2s polling → `LISTEN/NOTIFY`; queue patterns → `SKIP LOCKED`. One database for the project's plausible life.
- Maximum boringness per capability: one compose line, first-class Drizzle support, both devs know it.
- Portfolio continuity: PostgreSQL is on the CV; the repo should corroborate its claims.

**Alternatives:**

- **SQLite** — tempting (zero containers), but multiple processes across a container boundary (backend container + host demo-agents) is its weak spot, JSON support is well short of `jsonb`, and demonstrating production shape (compose, migrations, a real DB) is part of the point.
- **MongoDB** — would work, but adds nothing over `jsonb` while costing SQL aggregation ergonomics and Drizzle's type story; its real strengths (schema flexibility at scale, sharding) aren't in our problem.
- **ClickHouse / Timescale** — what real observability backends use at volume; absurd operational weight for ~50-event sessions. The write path stays a portable event log; a columnar read store is a bolt-on if volume ever demands it.
- **Kafka / event stores** — category error: transport, not a query store; you'd still need a database beside it to serve the graph API.

**Storage rules (bind the implementation):**

- Only Zod-validated events reach the table — the DB stores trusted data behind the contract boundary; it does not enforce shape itself.
- Events are **re-parsed with `TraceEvent` on read** during reconstruction: rows from an older schema version or manual edits degrade gracefully (FR-3.6 posture) instead of crashing.
- No `sessions` table — sessions are derived by aggregation (see
  [scaffolding design, step 6](design/scaffolding.md)); a materialized read model
  is the future optimization, never a change to the write path.

**Honest costs:** a database container at all (vs SQLite's nothing); some jsonb row-size overhead. Both trivial at demo scale.

---

## DD-11: Emitter batching, and why the flush interval ignores the poll interval

**Decision:** The emitter never sends one HTTP request per event. Events go into an in-memory queue, flushed as an `IngestBatch` (1–100 events) when the first of three triggers fires: queue reaches N events (~10), the oldest queued event is ~300ms old, or `session.flush()` at process exit. N and 300ms are tuning constants (implementation); the 1–100 batch range is contract.

**Why batch (simple terms):**

- Agent runs emit in bursts — a `delegated`, `agent_started`, and `llm_called` can land within milliseconds. Per-event requests pay connection overhead per event and multiply failure opportunities; a batch is one request and one insert transaction.
- Batching is what makes three other design pieces make sense: the partial-rejection response (one bad event must not sink its batch-mates, FR-2.3), the `event_id` idempotency key (an ambiguous flush failure is retried whole — duplicates are counted, not stored, DD-10), and together those give at-least-once delivery with no bookkeeping.
- Same pattern as OTel's batch span processor — the emitter stays conceptually aligned with what replaces it in v1.2.

**Why flush at ~300ms when the UI polls at 2s — three independent reasons:**

1. **Latencies add up.** UI staleness ≈ flush delay + poll delay. At 300ms the poll dominates (as it should) and the graph grows smoothly; a 2s flush means ~4s worst case and clumpy, jumping live-draw (plus aliasing when producer and consumer intervals are similar).
2. **The buffer is an amnesia window.** Queued events die with a crash, and the events just before a crash are exactly what a flight recorder must not lose. 300ms caps the loss at a third of a second; 2s can lose the entire interesting part.
3. **The emitter must not know about the frontend.** The 2s poll is a frontend detail scheduled to change (roadmap: push updates). When two constants live in different components, matching them is coupling, not consistency — each component tunes against its own constraints (network overhead vs freshness vs loss window; server load vs liveness).

**Cost check:** the time trigger fires only when the queue is non-empty — a quiet emitter sends nothing; sustained worst case is ~3 small requests/second from one demo app.

---

_Scope-level decisions (Postgres-not-Kafka framing, polling-not-WebSockets, React Flow-not-hand-rolled layout, the two structural cuts) live in [MVP scope](mvp-scope.md)._
