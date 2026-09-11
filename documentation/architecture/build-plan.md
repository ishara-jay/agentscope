# Monorepo build plan (E0 scaffolding, step by step)

How we build the repo skeleton, one small step at a time. **Each step is one PR**: it has an owner, a "done when" check, and leaves `main` green. The steps map 1:1 onto E0 user stories in the [delivery plan](delivery-plan.md).

## Tooling decisions (made here, once)

| Decision            | Choice                                                             | Why (simple terms)                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager     | **pnpm workspaces**                                                | Fast, strict about dependencies (a package can only import what it declares — keeps the contract honest), the current standard for TS monorepos. Enable via `corepack enable`.                     |
| Build orchestration | **None (plain pnpm scripts)**                                      | Turborepo/Nx add caching we don't need for 5 small packages in a 3-day build. `pnpm -r run build` is enough. Revisit only if builds get slow.                                                      |
| Test runner         | **Vitest everywhere**                                              | One runner for all packages (Nest's default is Jest, but mixed runners means two configs to learn). Fast, TS-native.                                                                               |
| Frontend build      | **Vite + React**                                                   | The UI is a pure client-side SPA polling an API — no SSR need, so Next.js would be extra machinery.                                                                                                |
| Database access     | **Drizzle ORM**                                                    | Type-safe and close to SQL (readable — fits the reference-implementation goal), light, with simple migrations. Heavier codegen ORMs (Prisma) or aging ones (TypeORM) don't earn their weight here. |
| Lint/format         | **ESLint (flat config) + Prettier**, one shared config at the root | Zero per-package drift.                                                                                                                                                                            |

## Target structure

```
agentscope/
├── package.json                # root, private, workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json          # every package extends this
├── eslint.config.js  .prettierrc  .editorconfig  .gitignore
├── .env.example                # every env var the system reads, documented
├── docker-compose.yml          # postgres now; backend/frontend services in step 10
├── config/
│   └── prices.json             # runtime-read price file (FR-3.3 / DD-8), mounted into backend
├── .github/workflows/ci.yml    # lint → typecheck → test → build
├── packages/
│   ├── contract/               # @agentscope/contract — Zod schemas, inferred types, fixture.json
│   └── emitter/                # @agentscope/emitter — depends on contract (DD-3)
├── apps/
│   ├── backend/                # @agentscope/backend — NestJS (ingest + read APIs)
│   ├── frontend/               # @agentscope/frontend — Vite/React + React Flow
│   └── demo-agents/            # @agentscope/demo-agents — LlmClient port + Gemini adapter (DD-6/7)
└── documentation/              # this folder (site workspace may join later as apps/site)
```

**Dependency direction (only ever downward):**

```
demo-agents ──▶ emitter ──▶ contract ◀── backend
frontend ──────────────────────────────▶ contract
```

`contract` depends on nothing internal. Nothing depends on an app. pnpm's strictness enforces this — an undeclared import fails.

## The steps

Owners follow the E0 split in the team plan (A: workspaces/contract/compose; B: CI/configs/frontend). Steps 1–2 are sequential; after that A and B proceed in parallel on their tracks.

### Step 1 — Root workspace _(Dev A)_

Root `package.json` (private, `engines` pinning Node LTS + pnpm), `pnpm-workspace.yaml` listing `packages/*` and `apps/*`, `.gitignore`, `.editorconfig`.
**Done when:** `pnpm install` succeeds on a fresh clone.

### Step 2 — Shared TS + lint config _(Dev B)_

`tsconfig.base.json` (strict mode on), root ESLint flat config + Prettier, root scripts: `lint`, `typecheck`, `test`, `build` running recursively.
**Done when:** `pnpm lint && pnpm typecheck` pass at the root (trivially, nothing exists yet).

### Step 3 — `packages/contract` _(Dev A — this is the Day-1 pairing output landing as code)_

Zod schemas for the five event types + graph API response, inferred types exported, `fixture.json` (the one complete fake session), and a Vitest test that validates the fixture against the schemas (DD-5's CI check).
**Done when:** `pnpm --filter @agentscope/contract test` passes; a deliberately broken fixture fails it.

### Step 4 — `packages/emitter` skeleton _(Dev A)_

Package depending on `contract`; exports stub functions with real signatures (span context comes later in E1).
**Done when:** it builds, and demo-agents will be able to import it.

### Step 5 — `apps/backend` bootstrap _(Dev A)_

NestJS app extending the base tsconfig, depending on `contract`; a `/health` endpoint; Vitest wired.
**Done when:** `pnpm --filter @agentscope/backend start:dev` serves `GET /health → 200`.

### Step 6 — Postgres + Drizzle _(Dev A)_

`docker-compose.yml` with Postgres + named volume; Drizzle configured in backend; first migration (events table per the contract).
**Done when:** `docker compose up -d postgres` + migrate runs clean; backend connects.

### Step 7 — `apps/frontend` bootstrap _(Dev B)_

Vite React app extending base config, depending on `contract`; React Flow installed; renders a hardcoded two-node graph from `fixture.json` imports.
**Done when:** `pnpm --filter @agentscope/frontend dev` shows nodes in the browser.

### Step 8 — `apps/demo-agents` skeleton _(Dev A)_

CLI entry point; `LlmClient` interface + a `FakeLlmClient` returning canned responses (real Gemini adapter is E1); `LLM_PROVIDER` read from env; imports emitter.
**Done when:** `pnpm --filter @agentscope/demo-agents start` runs a fake conversation to stdout.

### Step 9 — CI _(Dev B)_

GitHub Actions: pnpm cache → install → `lint` → `typecheck` → `test` → `build`, on PRs and main. Badge in the repo README.
**Done when:** the pipeline is green on a PR, and a deliberately broken fixture turns it red.

### Step 10 — Full compose + env _(Dev A, closes E0)_

Dockerfiles for backend/frontend; compose gains both services plus the `config/prices.json` mount and env wiring; `.env.example` documents every variable (`DATABASE_URL`, `LLM_PROVIDER`, `GEMINI_API_KEY`, `PRICES_FILE`, ports).
**Done when:** `docker compose up` on a fresh clone serves the UI, backend `/health`, and Postgres — the NFR-1 one-command boot, proven before any feature code.

## Working rules for E0

- One step = one PR = one owner + one cross-reviewer (per the team plan). Keep PRs mergeable in minutes.
- Steps 3's schemas are frozen contract (NFR-2): after it merges, changes need both devs + fixture update in the same commit.
- Don't gold-plate scaffolding: no Turborepo, no Storybook, no husky hooks, no renovate — E0 exists to make E1/E2 fast, not to be impressive itself.
