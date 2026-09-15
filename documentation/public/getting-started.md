# Getting started

AgentScope is under active development. The repository includes a production
Compose shape for PostgreSQL, the backend health service, and the browser UI.
The deterministic multi-agent example remains available through the CLI.

## Prerequisites

- Node.js 24 or newer
- pnpm 11 (the exact version is pinned in `package.json`)
- Docker with Compose

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

## Start the application stack

```bash
cp .env.example .env
docker compose up --build
```

The frontend is available at `http://localhost:3000` and the backend health
endpoint is available at `http://localhost:3001/health`. A healthy service
returns:

```json
{ "status": "ok" }
```

Stop the stack without deleting its named volume:

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
