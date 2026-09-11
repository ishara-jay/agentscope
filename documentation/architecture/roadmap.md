# Roadmap (deliberately deferred)

Everything here was consciously cut from the 3-day MVP. Naming the hard problems we deferred — and why — is part of the project's design-decisions story.

## v1.1 — Evaluation: session replay & diff

The headline deferral. Re-run a recorded session with a changed prompt or model and **diff the two conversation graphs side by side**: did the tool-call sequence change, did cost drop, did the answer improve? Deliberately a diff view, not scoring models — its existence is the signal. Cut because it is severable and costs a day-plus.

## v1.2 — True OpenTelemetry ingestion

Accept arbitrary OTel spans (GenAI semantic conventions) from any instrumented framework, not just our emitter. This is the genuinely hard part we cut: out-of-order arrival, orphaned spans, sessions that never close, per-framework attribute dialects. Field names in the v1 schema were chosen OTel-aligned specifically to keep this door open.

In simple terms: v1 already lets any client POST events and checks each one (shape and fields — cheap). What v1 does **not** do is fix broken or foreign streams — events in the wrong order, missing parents, other frameworks' naming. v1.2 is that repair-and-translate layer. Until then, a broken stream degrades gracefully in the graph instead of being repaired (FR-3.6).

## Later / opportunistic

- **Anthropic `LlmClient` adapter** — second provider behind the DD-6 port (`LLM_PROVIDER=anthropic`), proving provider-neutral tracing with an env-var flip; first candidate for unused Day-3 buffer. Prerequisite: Anthropic Console API credits (separate from a claude.ai subscription)
- **Replay timeline scrubbing** — step through the session like a video instead of the static event list
- **Self-observability** — Prometheus metrics on the ingest pipeline + Grafana dashboard (an observability tool that observes itself)
- **Cloud deploy** — hosted demo instance on Azure (stretch goal already if Day 3 buffer is unused)
- **WebSocket live updates** — replace 2s polling
- **Price table management API/UI** — edit per-model prices at runtime through the app instead of the mounted JSON file (DD-8); past sessions re-price automatically either way, since cost is derived at read time
- **Session search & filtering**, larger-graph virtualization
- **Framework adapters** (LangGraph, etc.) — explicitly out of scope until OTel ingest exists
- **Auth / multi-tenancy** — only if the hosted demo ever needs it
- **Split ingest into its own service** — the write and read paths have fundamentally different profiles: ingest is bursty, write-heavy, and availability-critical (a dropped event is gone forever), while the read side is human-paced and tolerant (a down read API loses nothing). When those profiles actually diverge under real volume — and not one day before — ingest becomes its own deployable (N replicas behind a load balancer, single-writer discipline over the shared event log; a queue between ingest and the DB is the step after that). Real observability backends (Grafana Loki/Tempo/Mimir) split exactly this way: ingesters vs queriers. The v1 design keeps this split cheap on purpose: `ingest/` and `sessions/` are separate NestJS modules forbidden from importing each other, both sides share only `packages/contract` and the database, and the emitter targets ingest via one env var — so the split is a folder move plus a compose service, not a rewrite.

## Non-goals (for any version)

- Competing with Langfuse/MLflow/Phoenix/Laminar on breadth
- Prompt management, hosted SaaS, billing
- LLM-judge scoring inside the eval harness
- **Per-language emitter SDKs** — polyglot support arrives via OTel/OTLP ingestion, never via porting the emitter (see DD-4)
