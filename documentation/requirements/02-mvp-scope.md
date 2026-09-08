# 02 — MVP Scope (2 developers × 3 days)

Budget: 6 dev-days, AI-assisted. The scope fits not by shaving every feature by 40%, but by **cutting the two hardest problems entirely** and keeping the one demo that carries the project.

## Structural cut 1: no generic OTel ingestion — we own both ends of the wire

Accepting arbitrary OpenTelemetry spans means solving out-of-order arrival, orphaned spans, sessions that never close, and other frameworks' attribute conventions. That is the hard 20% and could alone consume the 3 days.

Instead:

- Define a small, **typed event schema**: `agent_started`, `llm_called`, `tool_called`, `delegated`, `agent_finished` — each carrying `session_id`, `span_id`, `parent_span_id`, token counts, latency.
- Ship a **~100-line TypeScript emitter helper** used by the demo app.
- Because we control the emitter, events arrive well-formed and graph reconstruction becomes a simple parent-pointer walk instead of a distributed-systems problem.
- Keep field **names** aligned with OTel GenAI semantic conventions; "true OTel ingest" goes on the roadmap. Credibility kept, cost not paid.

## Structural cut 2: no eval/diff harness

Severable (nothing depends on it), costs a day-plus. It becomes the loudest roadmap item.

## Also cut from v1

- Replay timeline scrubbing → an ordered event list beside the graph gives ~80% of the value
- Self-metrics / Grafana dashboard
- Auth, multi-tenancy
- Session search/filtering
- Cloud deploy — `docker compose up` **is** the v1 deploy story (Azure = stretch goal if Day 3 goes well)
- WebSockets — 2-second polling is indistinguishable in the demo

## The irreducible core (what survives)

Everything kept serves one sentence: _run the demo agents, watch the DAG draw itself live, click a node, see the exact prompt/response/cost behind that decision._

1. **Demo app** — 3 agents (orchestrator → researcher + writer), 2–3 tools, google-genai SDK
2. **Emitter helper** + thin NestJS ingest endpoint + Postgres event store
3. **Graph API** — `GET /sessions/:id/graph`: reconstructed DAG with per-node latency/tokens/cost (static price table) and rolled-up totals
4. **React UI** — session list, DAG view (React Flow + dagre/elkjs — do not hand-roll layout), node detail panel, 2s polling for live-draw

## Definition of done (ship when all five are true)

1. Clone → `docker compose up` boots everything with one command
2. Click "run demo task" → agents execute a real task via google-genai
3. The conversation graph draws itself live in the UI
4. Clicking any node shows the exact prompt, response, tokens, and cost behind it
5. README contains the demo GIF, an architecture diagram, and a design-decisions section

Anything beyond these five is roadmap, not scope.

## Known risk

React Flow layout of a dynamically growing DAG can eat a full day if the layout engine fights back. **Timebox to half a day**; fallback is a simple left-to-right tree layout, which demos nearly as well for a ~6-node graph.
