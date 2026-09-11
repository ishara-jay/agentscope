# Getting started

AgentScope is under active development. Today you can validate the shared
contract, run the deterministic multi-agent example, start PostgreSQL, and run
the backend health service. Ingest, graph APIs, and the browser UI are not yet
available.

## Prerequisites

- Node.js 24 or newer
- pnpm 11 (the exact version is pinned in `package.json`)
- Docker with Compose for PostgreSQL

## Install and verify

From the repository root:

```bash
pnpm install
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

`pnpm build` comes before `pnpm typecheck` because workspace packages consume
generated declarations from dependency `dist/` directories on a clean clone.

## Start the database and backend

```bash
docker compose up -d postgres
DATABASE_URL=postgres://agentscope:agentscope@localhost:5434/agentscope \
  pnpm --filter @agentscope/backend db:migrate
DATABASE_URL=postgres://agentscope:agentscope@localhost:5434/agentscope \
  pnpm --filter @agentscope/backend start:dev
```

Open `http://localhost:3001/health`. A healthy service returns:

```json
{ "status": "ok" }
```

Stop PostgreSQL without deleting its named volume:

```bash
docker compose down
```

## Run the deterministic demo

In another terminal:

```bash
pnpm --filter @agentscope/demo-agents start -- \
  "Explain why observable agent workflows matter"
```

The fake provider requires no key or network access. It drives an orchestrator,
researcher, writer, search tool, and source-reading tool through the same
interfaces intended for the real provider. Event delivery is still a stub, so
the demo does not yet persist a trace.

## Useful focused commands

```bash
pnpm --filter @agentscope/contract test
pnpm --filter @agentscope/emitter test
pnpm --filter @agentscope/backend test
pnpm --filter @agentscope/demo-agents test
```

See the [requirement registry](../requirements/README.md) for delivery status.
