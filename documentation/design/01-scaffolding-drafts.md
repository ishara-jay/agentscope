# Design 01 — Scaffolding Drafts (E0 steps 1–2, 5–10)

Draft contents for every scaffolding file, ready to be applied step by step per [07-monorepo-plan.md](../requirements/07-monorepo-plan.md). These are **design drafts** — exact versions get pinned at implementation time (`pnpm add` resolves latest stable; drafts show intent, not lockfile truth). The contract package (steps 3–4) has its own design: [02-contract-design.md](02-contract-design.md).

---

## Step 1 — Root workspace (Dev A)

### `package.json` (root)

```json
{
  "name": "agentscope",
  "private": true,
  "engines": { "node": ">=22", "pnpm": ">=9" },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "pnpm -r run typecheck",
    "test": "pnpm -r run test",
    "build": "pnpm -r run build",
    "dev": "pnpm -r --parallel run dev"
  }
}
```

Notes: `private: true` (the root is never published); `packageManager` pins pnpm for corepack so both devs and CI run the identical version.

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### `.gitignore`

```
node_modules/
dist/
coverage/
.env
*.local
.DS_Store
```

Note: `.env` ignored, `.env.example` committed (step 10). `pnpm-lock.yaml` is **committed**, never ignored — it is how CI and both devs get identical dependency trees.

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## Step 2 — Shared TS + lint config (Dev B)

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

Every package extends this and overrides only what it must (frontend: `module: ESNext` + `jsx: react-jsx` + DOM libs; backend: `emitDecoratorMetadata`/`experimentalDecorators` for Nest).

### `eslint.config.js` (flat config)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  prettier, // last: turns off formatting rules so Prettier owns style
);
```

Design rule (from the CI discussion): small rule set, **everything at error level** — a rule worth having is worth failing the build for.

**As-built notes (step 2 implementation, 2026-09-08):**

- `no-floating-promises` is a _type-aware_ rule → requires `projectService: true`, and type-aware linting is scoped to `**/*.ts(x)` only so JS config files don't need a tsconfig. (The original draft omitted this and would fail with "you must provide parserOptions.project".)
- **TypeScript is pinned to the 6.x line**, not latest: typescript-eslint supports `<6.1.0`, while `pnpm add typescript` resolves to 7.x (the Go-native compiler line), which the lint toolchain can't consume yet. Revisit when typescript-eslint declares TS 7 support.
- Root `package.json` carries `"type": "module"` (the eslint config is ESM).
- A one-time `pnpm format` normalized all pre-existing docs so `format:check` starts green (planned gotcha #2).

### `.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

### `.prettierignore`

```
pnpm-lock.yaml
dist/
coverage/
```

(Lockfile is machine-owned; build output is belt-and-braces with ESLint's ignores.)

### `.vscode/settings.json` (committed — makes enforcement a non-event locally)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

---

## Step 5 — `apps/backend` bootstrap (Dev A)

Layout (Nest, one module per concern — matches the write/read path split):

```
apps/backend/
├── package.json            # @agentscope/backend; deps: @nestjs/*, drizzle-orm, pg, zod,
│                           #   @agentscope/contract (workspace:*)
├── tsconfig.json           # extends base + Nest decorator flags
├── drizzle.config.ts
└── src/
    ├── main.ts             # bootstrap, port from env (default 3001)
    ├── app.module.ts
    ├── health/health.controller.ts     # GET /health → { status: "ok" }
    ├── ingest/             # E1 (Dev A): POST /events
    ├── sessions/           # E2 (Dev B): GET /sessions, GET /sessions/:id/graph
    ├── pricing/price.service.ts        # reads PRICES_FILE per request (DD-8)
    └── db/
        ├── schema.ts       # Drizzle table defs (step 6)
        ├── database.client.ts # Nest lifecycle + pg pool from DATABASE_URL
        └── database.module.ts # exports DatabaseClient to feature modules
```

`ingest/` and `sessions/` are separate Nest modules with no imports of each other — the write/read path ownership boundary is visible in the folder tree.

**As-built notes (step 5 implementation, 2026-09-10):**

- The bootstrap contains only `main.ts`, `AppModule`, and `HealthController`; Drizzle, database connections, ingest/session routes, pricing, and their placeholder directories remain deferred to their owning steps.
- The backend stays ESM/NodeNext like the rest of the workspace. Nest's decorator flags live in the backend `tsconfig.json`, while `tsconfig.build.json` emits `src` to `dist` and excludes tests.
- Vitest compiles Nest decorators through `unplugin-swc`/SWC; pnpm's workspace policy allows only `@swc/core` to run its native install script. The HTTP test uses Nest's testing module and Supertest to assert the exact `GET /health` response, then closes the test application.
- Runtime startup uses the standard Nest Express adapter, reads optional `PORT`, and defaults to `3001`.

---

## Step 6 — Postgres + Drizzle (Dev A)

### `docker-compose.yml` (step-6 version; grows in step 10)

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: agentscope
      POSTGRES_PASSWORD: agentscope
      POSTGRES_DB: agentscope
    ports:
      - '5434:5432'
    volumes:
      - pgdata-agentscope:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U agentscope -d agentscope']
      interval: 2s
      timeout: 5s
      retries: 15
volumes:
  pgdata-agentscope:
```

### `apps/backend/src/db/schema.ts` — the one table

```ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    eventId: uuid('event_id').primaryKey(),
    sessionId: uuid('session_id').notNull(),
    spanId: text('span_id').notNull(),
    parentSpanId: text('parent_span_id'), // null = root span
    type: text('type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('events_session_idx').on(t.sessionId, t.timestamp)],
);
```

**Design decision — one table, no `sessions` table.** Sessions are derived (`GROUP BY session_id`: min timestamp = started, terminal event = status, token sums = totals). Append-only ingest stays trivially simple (FR-2.2), and at demo scale (~50 events/session) the aggregation is free. A materialized `sessions` table is a later optimization, not a schema change for producers.

`event_id` as primary key gives idempotent ingest for free: replayed events conflict on PK and are skipped (`ON CONFLICT DO NOTHING`).

**Storage mapping (DD-10):** the contract's envelope/payload split maps one-to-one onto columns/jsonb — envelope fields become real columns because they're what we query, index, and group by; the per-type payload stays one opaque `jsonb` column because SQL never looks inside it in v1. Write path: Zod-validate → split → insert (only trusted data reaches the table). Read path: reassemble `{...columns, payload}` and **re-parse with `TraceEvent`** before reconstruction, so stale or hand-edited rows degrade gracefully (FR-3.6) instead of crashing.

**As-built notes (step 6 implementation, 2026-09-11):**

- Host processes use `postgres://agentscope:agentscope@localhost:5434/agentscope`; future Compose services use the same credentials at `postgres:5432`. The project-scoped `pgdata-agentscope` volume uses PostgreSQL 17's standard `/var/lib/postgresql/data` path and deliberately has no global Compose volume name.
- `DatabaseClient` requires `DATABASE_URL`, owns the `pg.Pool`, exposes the schema-typed Drizzle client, verifies the connection with `SELECT 1` during Nest module initialization, and closes the pool during module destruction. Nest shutdown hooks make process signals run that lifecycle cleanup. Feature modules consume the exported client; Drizzle types do not cross into HTTP or shared packages.
- The committed Drizzle migration creates only the append-only `events` table and its `(session_id, timestamp)` index. There are no sessions/metrics tables, database enums, span foreign keys, seed data, ingest queries, or speculative OTel columns.

### Future telemetry boundary (recorded, not implemented in step 6)

- Client integrations ultimately emit OpenTelemetry GenAI spans and metrics. An OpenTelemetry Collector receives telemetry once and fans it out; AgentScope later accepts OTLP and normalizes relevant spans into its internal event model.
- Honeycomb receives traces and metrics through an OTLP exporter. Grafana uses native GenAI metrics through Prometheus/Mimir, derived latency/call-rate/error metrics from a span-metrics connector, and Tempo for traces when desired.
- AgentScope neither implements PromQL nor acts as a metrics database. PostgreSQL is optimized for session reconstruction and event inspection, while Prometheus-compatible storage owns client-agent metrics and PromQL.
- High-cardinality session IDs, span IDs, prompts, and responses remain trace attributes rather than Prometheus labels. Resource attributes and native OTel trace identifiers wait for the later OTLP contract and migration, when their precise shape is settled.

---

## Step 7 — `apps/frontend` bootstrap (Dev B)

```
apps/frontend/
├── package.json         # @agentscope/frontend; deps: react, react-dom, @xyflow/react,
│                        #   @agentscope/contract (workspace:*); dev: vite, @vitejs/plugin-react
├── tsconfig.json        # extends base + DOM/JSX overrides
├── vite.config.ts       # dev proxy: /api → http://localhost:3001
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx              # session list ⇄ session view routing (no router lib — one useState)
    ├── api/client.ts        # typed fetch wrappers over contract types; 2s polling hook
    ├── graph/               # E2: DAG view (React Flow), layout, node components
    ├── detail/              # node detail panel
    └── fixtures.ts          # imports fixture.json from contract for pre-backend dev
```

Design choices: `@xyflow/react` (React Flow v12); no router library (two views, one state variable); the dev proxy means the frontend never hardcodes a backend origin.

---

## Step 8 — `apps/demo-agents` skeleton (Dev A)

```
apps/demo-agents/
├── package.json         # @agentscope/demo-agents; deps: @agentscope/emitter, @agentscope/contract,
│                        #   @google/genai (E1); bin: agentscope-demo
└── src/
    ├── main.ts          # CLI entry: run one demo task, print session URL
    ├── llm/
    │   ├── client.ts    # LlmClient interface (DD-6) — drafted in 02-contract-design.md §5
    │   ├── fake.ts      # FakeLlmClient: canned responses, zero network (step-8 "done when")
    │   └── gemini.ts    # E1: google-genai adapter
    ├── agents/          # orchestrator.ts, researcher.ts, writer.ts + hand-rolled loop (DD-7)
    └── tools/           # 2–3 demo tools (e.g. search, calculator)
```

`FakeLlmClient` is a first-class design element, not a throwaway: it makes `pnpm --filter demo-agents start` work with no API key (reviewer-friendly), gives deterministic integration tests, and is the flakiness fallback from the team plan.

---

## Step 9 — CI (Dev B)

### `.github/workflows/ci.yml`

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4 # reads version from packageManager field
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test # includes contract's fixture-vs-schema check (DD-5)
      - run: pnpm build
```

`--frozen-lockfile` makes CI fail if someone edits a `package.json` without updating the lockfile. Badge goes in the repo README.

---

## Step 10 — Full compose + env (Dev A)

### `docker-compose.yml` (final E0 shape)

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: agentscope
      POSTGRES_PASSWORD: agentscope
      POSTGRES_DB: agentscope
    ports: ['5432:5432']
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U agentscope']
      interval: 2s
      retries: 15

  backend:
    build: { context: ., dockerfile: apps/backend/Dockerfile }
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://agentscope:agentscope@postgres:5432/agentscope
      PRICES_FILE: /app/config/prices.json
      PORT: 3001
    volumes:
      - ./config/prices.json:/app/config/prices.json:ro # bind mount: edit → live re-price (DD-8)
    ports: ['3001:3001']

  frontend:
    build: { context: ., dockerfile: apps/frontend/Dockerfile }
    depends_on: [backend]
    ports: ['3000:80'] # nginx serving the built SPA, /api proxied to backend

volumes:
  pgdata:
```

Dockerfiles: standard two-stage pnpm builds (`corepack enable` → `pnpm install --frozen-lockfile --filter <app>...` → build → slim runtime; frontend's runtime stage is nginx with an `/api` proxy). Demo-agents runs from the host via CLI in v1 (it needs the operator's `GEMINI_API_KEY`), triggered against the composed backend.

### `config/prices.json` (seed)

```json
{
  "gemini-2.5-flash": { "input_per_mtok": 0.3, "output_per_mtok": 2.5 },
  "fake-model": { "input_per_mtok": 0, "output_per_mtok": 0 }
}
```

(Prices are illustrative seeds — verify against the provider's current pricing page when E1 lands; unknown IDs degrade per FR-3.3.1 regardless.)

### `.env.example`

```bash
# --- backend ---
DATABASE_URL=postgres://agentscope:agentscope@localhost:5432/agentscope
PRICES_FILE=./config/prices.json
PORT=3001

# --- demo-agents ---
LLM_PROVIDER=fake            # fake | gemini
GEMINI_API_KEY=              # required only when LLM_PROVIDER=gemini
AGENTSCOPE_ENDPOINT=http://localhost:3001
```

---

## Dependency versions policy

Drafts intentionally omit version numbers. At implementation: install latest stable via `pnpm add`, commit the lockfile, and let `--frozen-lockfile` in CI keep everyone identical. Pin only `packageManager` (exact) and `engines` (floor).
