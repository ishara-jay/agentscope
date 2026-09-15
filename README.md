# AgentScope

AgentScope is a flight recorder for multi-agent LLM systems. It captures a run
as typed trace events and turns those events into a conversation graph so a
developer can see delegation, tool use, prompts, responses, latency, tokens,
and cost in one place.

> **Project status:** early MVP development. The shared contract, emitter API
> scaffold, PostgreSQL schema, backend health service, and deterministic demo
> workflow exist. Event transport, ingest, graph APIs, and the web viewer are
> still being built.

## Why it exists

Flat logs are a poor fit for multi-agent systems. When an orchestrator delegates
to specialists, tools fan out, and control flow changes between runs, the useful
question is structural: who did what, for whom, with which context, and at what
cost? AgentScope is designed to answer that as a graph and ordered replay.

## Target MVP

```text
demo agents ──▶ typed emitter ──▶ NestJS ingest ──▶ PostgreSQL
                                            │
                                            ▼
                                  graph reconstruction
                                            │
                                            ▼
                                  React session viewer
```

The MVP is intentionally narrow:

- one deterministic three-agent demo plus a Gemini adapter;
- a small TypeScript event emitter;
- append-only PostgreSQL event storage;
- session and graph read APIs with token/cost rollups;
- a React graph, event list, and node detail view;
- one-command local startup when the MVP is complete.

## Repository layout

| Path                | Purpose                                                        | Current state                              |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `packages/contract` | Canonical Zod schemas and a complete trace fixture             | Implemented                                |
| `packages/emitter`  | Instrumentation wrappers and event transport                   | API scaffold; transport planned            |
| `apps/backend`      | NestJS API and PostgreSQL access                               | Health endpoint and schema implemented     |
| `apps/demo-agents`  | Orchestrator, researcher, writer, tools, and provider boundary | Deterministic fake flow implemented        |
| `apps/frontend`     | Session graph viewer                                           | Planned                                    |
| `documentation`     | Architecture, requirements, and public developer docs          | [Browse the docs](documentation/README.md) |

## Quick start

Prerequisites: Node.js 24+, pnpm 11+, and Docker.

```bash
pnpm install
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Run the currently implemented backend locally:

```bash
docker compose up -d postgres
DATABASE_URL=postgres://agentscope:agentscope@localhost:5434/agentscope \
  pnpm --filter @agentscope/backend db:migrate
DATABASE_URL=postgres://agentscope:agentscope@localhost:5434/agentscope \
  pnpm --filter @agentscope/backend start:dev
```

Then check `http://localhost:3001/health`; it returns `{"status":"ok"}`.

In another terminal, run the deterministic demo workflow:

```bash
pnpm --filter @agentscope/demo-agents start -- \
  "Explain why observable agent workflows matter"
```

The demo currently exercises the orchestration flow, but the emitter transport
is still a stub, so this command does not yet create a stored session.

## Documentation

- [Architecture, vision, roadmap, and decisions](documentation/architecture/README.md)
- [Requirement registry](documentation/requirements/README.md)
- [Public developer docs](documentation/public/README.md)
- [Contributing workflow](documentation/public/contributing.md)

AI coding tools should read [AGENTS.md](AGENTS.md) before changing the
repository. More specific guidance is provided inside `apps/`, `packages/`, and
`documentation/`.

## License

[MIT](LICENSE)
