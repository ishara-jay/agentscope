# 06 — Design Decisions

Decisions made before implementation, with the alternatives considered and the conditions under which each should be revisited. The Day-3 README's design-decisions section is distilled from this file.

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

**Mental model:** the standard two-layer shape of telemetry systems — a wire protocol for interoperability plus a client SDK for correct-by-construction usage (OTel has OTLP *and* SDKs; nobody hand-crafts OTLP). The HTTP endpoint is the contract; the emitter is the paved road onto it.

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
- The failure mode to prevent is two *definitions* (emitter interfaces vs server DTOs) drifting apart. One Zod schema consumed everywhere makes drift impossible: a field added to the schema propagates to emitter types, server validation, and the fixture CI check in the same commit, or the build breaks.
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

*Scope-level decisions (Postgres-not-Kafka framing, polling-not-WebSockets, React Flow-not-hand-rolled layout, the two structural cuts) live in [02-mvp-scope.md](02-mvp-scope.md).*
