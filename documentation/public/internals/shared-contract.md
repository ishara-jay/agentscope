# Shared contract package

> One package defines every shape the system speaks — events, API responses, the price file — and everything else imports it, so the two sides of the wire can never disagree.

## How it works

Every piece of data in AgentScope has exactly one definition: a Zod schema in
`@agentscope/contract`. A Zod schema both **describes** a shape (TypeScript types
are derived from it at compile time) and **checks** it. Contract tests already
use runtime parsing; the ingest service will use that same parser when FR-2 is
implemented.

```
packages/contract  ←  the ONE definition (Zod schemas)
   ├─▶ emitter & apps:  inferred TS types      (compile-time)
   ├─▶ backend ingest:  schema.parse()         (planned runtime boundary)
   └─▶ CI:              fixture.json validated (the contract can't drift)
```

Alongside the schemas lives `fixture.json` — one complete, hand-crafted fake
session (orchestrator plans, delegates to a researcher who uses two tools, then
to a writer; 13 events, 8 spans). The schema says what's _allowed_; the fixture
shows what it _looks like_. Tests keep the two honest: every fixture event must
parse, cross-event span rules must hold, and deliberately broken events must
fail. The future frontend can render this fixture before the read API lands.

## Where the code lives

| What                                 | Where                                  |
| ------------------------------------ | -------------------------------------- |
| Event schemas + OTel mapping         | `packages/contract/src/events.ts`      |
| Read-API schemas (sessions, graph)   | `packages/contract/src/api.ts`         |
| Price-file schema                    | `packages/contract/src/prices.ts`      |
| The fake session                     | `packages/contract/fixture.json`       |
| Tests (fixture + span rules + fence) | `packages/contract/src/events.test.ts` |

## Decisions that shaped it

- [DD-5](../../architecture/decisions.md) — one definition, duplicated enforcement, never duplicated definitions
- [DD-11](../../architecture/decisions.md) — batch bounds 1–100 are contract; flush timing is not
- [Trace contract design](../../architecture/design/trace-contract.md) — span model, field-by-field drafts, and the as-built deltas (`duration_ms` rename, Zod 4 idioms)

## See it work

```bash
pnpm --filter @agentscope/contract test
```

Expected: `14 passed`. Then break it on purpose — change any `"type"` in `packages/contract/fixture.json` to `"bogus"`, rerun, watch it fail, undo.

## Known limits

- Schemas validate **one event at a time**; cross-event stream sanity (ordering,
  orphans) is the reconstruction layer's graceful-degradation job (FR-3.6), and
  real stream repair is [roadmap v1.2](../../architecture/roadmap.md).
- The OTel mapping is comments, not code — the translation layer that uses it arrives with OTLP ingest (v1.2).
