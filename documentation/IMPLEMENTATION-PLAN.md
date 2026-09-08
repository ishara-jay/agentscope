# AgentScope — Implementation Plan (handoff)

Everything left between the current state and a shipped MVP. Written to be executed without further planning: each row is one branch → one PR → cross-review → merge. Detailed drafts live in [design/](design/README.md); this file is the order of battle.

## Where we are

✅ Done (on `main`): E0 steps 1–3 — workspace root, shared TS/ESLint/Prettier config, and the **frozen contract** (`@agentscope/contract`: schemas + fixture + 14 tests).
🔒 `main` is protected: every change needs a PR with 1 approval; authors can't approve their own.

## How to work (applies to every row below)

1. Branch `feat/<step>` or `feat/<task>` → commit → `gh pr create` → the **other** dev reviews & approves → merge.
2. Docs ride in the same PR as the code they describe — including the matching [implementation/](implementation/README.md) doc and its status-table row.
3. Contract changes (`packages/contract`) need both devs + `fixture.json` updated in the same commit. CI enforces the fixture half.
4. Gates before every PR: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

## Phase A — finish scaffolding (E0 steps 4–10)

| #   | Step                 | Owner | Build                                                                                                                                                                       | Done when                                             | Design                                        |
| --- | -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| 4   | Emitter skeleton     | A     | `packages/emitter`: real API signatures (`startSession`, `agent`, `llmCall`, `toolCall`, `delegate`, `flush`), stub bodies. Include `dev-guide/git-workflow.md` in this PR. | Builds; importable                                    | [02 §5](design/02-contract-design.md)         |
| 5   | Backend bootstrap    | A     | NestJS app, `/health`, module layout (`ingest/`, `sessions/` — **no cross-imports, ever**)                                                                                  | `GET /health → 200`                                   | [01 step 5](design/01-scaffolding-drafts.md)  |
| 6   | Postgres + Drizzle   | A     | Compose postgres, events table, first migration                                                                                                                             | Migration applies; backend connects                   | [01 step 6](design/01-scaffolding-drafts.md)  |
| 7   | Frontend bootstrap   | B     | Vite + React + React Flow rendering `fixture.json` with duration/cost badges. **Timebox layout to ½ day**; fallback: left-to-right tree                                     | Fixture graph visible in browser                      | [01 step 7](design/01-scaffolding-drafts.md)  |
| 8   | Demo-agents skeleton | A     | CLI entry, `LlmClient` port + `FakeLlmClient`, `LLM_PROVIDER` env                                                                                                           | Fake conversation runs to stdout                      | [01 step 8](design/01-scaffolding-drafts.md)  |
| 9   | CI                   | B     | GitHub Actions: install → lint → format:check → typecheck → test → build. Then add the check to main's branch protection as required                                        | Green on a PR; broken fixture turns it red            | [01 step 9](design/01-scaffolding-drafts.md)  |
| 10  | Full compose         | A     | Dockerfiles, prices.json mount, `.env.example`                                                                                                                              | Fresh clone: `docker compose up` serves UI + API + DB | [01 step 10](design/01-scaffolding-drafts.md) |

Steps 5/6 (A) and 7/9 (B) run in parallel.

## Phase B — E1 write path (Dev A)

| Task                | What                                                                                                                                                                                                                         | Done when                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| B1 Emitter for real | Span context via wrap callbacks, ID generation, batching queue (≤10 events / ~300ms / `flush()` — DD-11), fire-and-forget POST with warn-only failures (FR-1.4)                                                              | Unit tests: parentage correct, batch triggers fire, a dead endpoint doesn't throw   |
| B2 Ingest module    | `POST /events`: envelope-strict pipe + per-event `safeParse` in service (two-stage — one bad event must not sink the batch, FR-2.3), insert with `ON CONFLICT (event_id) DO NOTHING`, 202 `{accepted, duplicates, rejected}` | Integration test: mixed batch → partial accept; replayed batch → duplicates counted |
| B3 Demo agents      | Hand-rolled loop (DD-7): orchestrator → researcher (2 tools) + writer; Gemini adapter behind `LlmClient`; instrumented at the port seam                                                                                      | Real run persists a session matching the fixture's shape                            |

## Phase C — E2 read path (Dev B)

| Task                  | What                                                                                                                                                                              | Done when                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C1 Reconstruction     | **Pair with A ~90 min first.** Events → nodes/edges (parent-pointer walk); delegation edges; rollups; degradation: orphans → `unattached`, no terminal event → `running` (FR-3.6) | Unit tests against fixture: expected nodes/edges/totals; orphan + unfinished cases |
| C2 Pricing + read API | `PriceService` reads `PRICES_FILE` per request (DD-8); unknown model → `cost_usd: null, cost_is_partial: true` (FR-3.3.1); `GET /sessions`, `GET /sessions/:id/graph`             | Endpoints serve fixture-fed data validating against contract schemas               |
| C3 UI on real data    | Swap fixture → API; node detail panel (exact prompt/response/tokens/cost); session list; 2s polling live-draw                                                                     | Run demo task → graph grows live → click node → see prompt                         |
| C4 Polish + GIF       | Graph visuals (it's the brand), record the ~30s demo GIF                                                                                                                          | GIF in repo                                                                        |

## Phase D — E3 ship (joint)

1. End-to-end on a fresh clone: `docker compose up` → run demo → live graph → detail panel.
2. Repo README: logo/name, pitch, GIF, architecture diagram, **design-decisions section** distilled from [DD-1…DD-11](requirements/06-design-decisions.md), quickstart, CI badge.
3. Launch write-up (blog/LinkedIn) — branding isn't done until people can find it.

## Definition of done — ship when all five are true ([02-mvp-scope](requirements/02-mvp-scope.md))

1. One-command boot · 2. Demo task runs real LLM calls · 3. Graph draws live · 4. Node detail shows exact prompt/cost · 5. README with GIF + architecture + decisions

## If time is left (in this order)

Anthropic `LlmClient` adapter → Azure deploy (needs static ingest token first — see auth discussion) → anything from the [roadmap](requirements/05-roadmap.md).

## Standing cautions

- Demo flakiness: pin low temperature, stable task; canned replay from stored events is the emergency demo.
- Don't gold-plate; don't start [VISION.md](VISION.md) work — _"if the MVP isn't shipped, that file is fiction."_
