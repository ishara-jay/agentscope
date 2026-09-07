# 04 — Team Plan (2 developers, 3 days)

## The critical move: freeze the contract in hour one

Day 1, first hour, both developers together agree and write down:
1. The **event schema** (all five event types, all fields)
2. The **graph API response shape** (`GET /sessions/:id/graph`)
3. A **`fixture.json`** — one complete fake session conforming to both

Dev B builds the entire UI against the fixture and never waits on Dev A. Integration on Day 3 is then a data swap, not a redesign.

## Split

| | Dev A — backend & agents | Dev B — frontend |
|---|---|---|
| **Day 1** | Emitter helper; ingest endpoint; Postgres schema; events persisting from a test script | UI shell; React Flow DAG rendering the fixture with latency/cost badges |
| **Day 2** | Demo agents wired to real google-genai calls; graph endpoint with cost rollups; sessions list endpoint | Node detail panel (prompt/response/tokens/cost); session list page; 2s live polling |
| **Day 3 (am)** | Integration on real data; `docker compose up` one-command boot | Visual polish on the graph (it's the brand); record the demo GIF |
| **Day 3 (pm)** | **Joint**: README (architecture diagram, design-decisions section naming what was cut and why), CI workflow, buffer — integration always finds something | |

## Timeboxes & fallbacks

- **React Flow dynamic layout**: max half a day (Day 1). Fallback: simple left-to-right tree layout — demos nearly as well at ~6 nodes.
- **Demo agent flakiness** (LLM nondeterminism): if the demo task occasionally derails, pin a low temperature and pick a task with a stable delegation shape; a canned replay from stored events is the emergency demo fallback.
- **Day 3 pm is buffer by design.** If it isn't needed, spend it on the Azure deploy stretch goal — in that order, never the reverse.

## Working agreements

- Any change to the event schema or API shape after Day 1 requires both devs to agree and `fixture.json` to be updated in the same commit.
- Definition of done is the five checks in [02-mvp-scope.md](02-mvp-scope.md); nothing else blocks shipping.
