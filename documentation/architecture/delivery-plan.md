# Delivery plan (2 developers, 3 days)

## Guiding decision: shared understanding is a deliverable

This is a portfolio project — **both developers must be able to explain every component afterwards.** The plan therefore splits work vertically by data flow (not backend-vs-frontend), pairs on the two conceptually rich pieces, and cross-reviews everything. The accepted cost: ~10–15% throughput, paid out of the Day-3 buffer — stretch goals become less likely, and that is the right trade.

## The split: write path vs read path

|      | Dev A — **write path**                                                                            | Dev B — **read path**                                                                      |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Owns | Emitter helper → ingest API → Postgres schema; demo agent app (incl. `LlmClient` port, DD-6/DD-7) | Graph reconstruction + cost rollups → `GET /sessions`, `GET /sessions/:id/graph`; React UI |

Both developers write NestJS, Postgres, and contract-adjacent code. Dev B owns the data shape they render — no handoff negotiation between "who makes the graph JSON" and "who draws it."

## Epics & user stories

Work is organized into four epics. **Each epic owner breaks their epic into user stories on Day 1 morning** (after the contract freeze) — stories small enough to be a single PR each. E0 is jointly owned with tasks explicitly assigned to both developers.

| Epic                        | Owner               | Contents                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E0 — Scaffolding**        | Joint (tasks split) | Mono-repo workspaces; shared contract package skeleton; docker-compose (Postgres); CI pipeline skeleton (lint, typecheck, test); shared tsconfig/lint config; `.env.example`. Suggested split — Dev A: workspaces, contract package, docker-compose; Dev B: CI workflow, lint/tsconfig, frontend app bootstrap |
| **E1 — Write path**         | Dev A               | Emitter helper (FR-1); ingest endpoint + storage (FR-2); demo agents with `LlmClient` port + Gemini adapter (FR-5)                                                                                                                                                                                             |
| **E2 — Read path**          | Dev B               | Graph reconstruction + rollups + sessions/graph endpoints (FR-3); session list, DAG view, node detail panel, live polling (FR-4)                                                                                                                                                                               |
| **E3 — Integration & ship** | Joint               | One-command boot; end-to-end run on real data; README (architecture diagram, design decisions distilled from the [decision log](decisions.md)); demo GIF; CI green                                                                                                                                             |

## Knowledge-sharing mechanisms (all three, non-negotiable)

1. **Two pairing sessions**, timeboxed:
   - Day 1, hour one — **the contract**: event schema, graph API response shape, `fixture.json` (one complete fake session).
   - Day 2, ~90 min — **graph reconstruction core**: pair on the parent-pointer walk and rollup logic (the algorithmic heart and likeliest interview topic), then Dev B finishes solo.
2. **100% cross-review**: every PR is reviewed by the other developer before merge. ~20–30 min/person/day; guarantees both have read every line by Day 3, and reads well in the GitHub history.
3. **One owner per task, always.** Rotation and review spread understanding; accountability stays singular. "We both own ingest" must never become "neither of us noticed ingest is behind." No mid-component handoffs — context-transfer cost exceeds learning value at this timescale.

## Day-by-day

|                | Dev A (write path)                                                                                                              | Dev B (read path)                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day 1 (am)** | **Joint:** contract freeze + `fixture.json` (hour one) → story breakdown per epic → E0 scaffolding tasks                        |                                                                                                                                               |
| **Day 1 (pm)** | Emitter helper; ingest endpoint; Postgres schema; events persisting from a test script                                          | React Flow DAG rendering the fixture with latency/cost badges (layout timeboxed — see below)                                                  |
| **Day 2**      | Demo agents with real Gemini calls behind the `LlmClient` port; instrumented end-to-end                                         | **Paired 90 min:** graph reconstruction core → solo: rollups, sessions + graph endpoints; wire UI from fixture to real API; node detail panel |
| **Day 3 (am)** | `docker compose up` one-command boot; "run demo task" trigger (UI/CLI); integration on real data                                | Session list page; 2s polling / live-draw; visual polish on the graph (it's the brand); record the demo GIF                                   |
| **Day 3 (pm)** | **Joint (E3):** README + architecture diagram + design-decisions section, CI green, buffer — integration always finds something |                                                                                                                                               |

## Deliverables

Definition of done stays the five checks in [MVP scope](mvp-scope.md). Mapped to epics:

1. One-command boot (E0 + E3)
2. Runnable demo task with real LLM calls (E1)
3. Live-drawing conversation graph (E1 feeds E2; the visible deliverable is E2)
4. Node detail — exact prompt/response/tokens/cost (E2)
5. README with GIF, architecture diagram, design decisions (E3)

## Timeboxes & fallbacks

- **React Flow dynamic layout** (Dev B, Day 1 pm): max half a day. Fallback: simple left-to-right tree layout — demos nearly as well at ~6 nodes.
- **Dev B's NestJS ramp** (if backend is newer ground for them): the Day-2 pairing session doubles as the on-ramp; if the graph endpoints slip, the node detail panel moves to Day 3 am and polish shrinks.
- **Demo agent flakiness** (LLM nondeterminism): pin a low temperature and a task with a stable delegation shape; canned replay from stored events is the emergency demo fallback.
- **Day 3 pm is buffer by design.** If unused, spend it on stretch goals in this order: Anthropic `LlmClient` adapter ([roadmap](roadmap.md)), then Azure deploy — never the reverse of buffer-first.

## Working agreements

- Any change to the event schema or API shape after Day 1 requires both devs to agree and `fixture.json` updated in the same commit (see DD-5 — CI validates the fixture against the schema).
- Every PR: one owner, one cross-reviewer, small enough to review in minutes.
- Definition of done is the five checks above; nothing else blocks shipping.
