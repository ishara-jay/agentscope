# Version upgrade runbook

Simple step-by-step guides for upgrading the toolchain and dependencies. One upgrade = one PR, reviewed like any other change. If a step fails, stop and use the rollback at the end of that section.

---

## 1. Upgrading pnpm

The version everyone uses is pinned in `package.json` → `"packageManager"`. Changing that one field moves both devs **and CI** together — nobody upgrades individually.

**Steps:**

1. Make sure your corepack is current (old corepack cannot run new pnpm majors — see the incident note below):
   ```bash
   npm install -g corepack@latest
   ```
2. From the repo root, pin the new version (this edits `package.json` for you and downloads the version):
   ```bash
   corepack use pnpm@<version>        # e.g. corepack use pnpm@12.3.4
   ```
3. Verify:
   ```bash
   pnpm -v                            # must print the new version
   pnpm install                       # must succeed; commit the lockfile if it changed
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
4. Commit `package.json` (+ `pnpm-lock.yaml` if changed), open the PR. When it merges, the other dev just runs `pnpm install` — corepack picks up the new pin automatically.

**Rollback:** revert the commit; corepack switches back on the next `pnpm` invocation.

> **Incident note (2026-09-08):** upgrading to pnpm 12 failed with `Cannot find module .../bin/pnpm.cjs` — pnpm 12 renamed its entry file to `pnpm.mjs`, and corepack 0.34.x still looks for the old name. Fix: step 1 (update corepack) **before** step 2. If corepack's cache is corrupted, clear it: `rm -rf ~/.cache/node/corepack/v1/pnpm/<version>` and retry.

---

## 2. Upgrading Node

The floor is set in `package.json` → `"engines"` and CI's `node-version`. Upgrade when a new LTS lands, not on every minor.

**Steps:**

1. Install the new Node locally (nvm, brew, or installer) and switch to it: `node -v`.
2. Update the repository version declarations:
   - `package.json` → `"engines": { "node": ">=<major>" }`
   - once CI exists, `.github/workflows/ci.yml` → `node-version: <major>`
3. Verify locally:
   ```bash
   pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
4. If backend/frontend Dockerfiles pin a Node base image, bump those tags in the same PR.
5. Open the PR. Until [NFR-6](../requirements/NFR-6-continuous-integration.md)
   lands, attach the local gate output; afterwards CI on the new version is the
   final verification.

**Rollback:** revert the commit and switch your local Node back.

---

## 3. Upgrading dependencies (packages)

The lockfile (`pnpm-lock.yaml`) is the source of truth — it is always committed, and CI installs with `--frozen-lockfile`, so an upgrade only ever happens through a PR that changes the lockfile.

**Routine upgrades (patch/minor):**

1. See what's outdated:
   ```bash
   pnpm -r outdated
   ```
2. Upgrade within declared ranges:
   ```bash
   pnpm -r update
   ```
3. Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, plus a quick manual run of whatever the change touches (`docker compose up`, run the demo task).
4. Commit `pnpm-lock.yaml` (+ any `package.json` changes), open the PR.

**Major upgrades (breaking-change risk):**

1. One major per PR — never batch majors, or you can't tell which one broke things.
2. Read the package's changelog/migration guide first.
3. Upgrade explicitly in the package(s) that use it:
   ```bash
   pnpm --filter @agentscope/<pkg> add <dep>@<major>
   ```
4. Fix what the compiler and tests surface, verify as above, PR.

**Rollback:** revert the commit; `pnpm install` restores the previous tree from the old lockfile.

---

## Rules that apply to every upgrade

- **One upgrade, one PR, one owner** — same as any other change; cross-review applies.
- **Frozen installs are the gate:** if `--frozen-lockfile` fails locally or in
  future CI, the lockfile and `package.json` disagree — run `pnpm install`
  locally and commit the lockfile.
- **Never upgrade during the last hours before a demo.** Upgrades are day-start work with a full verification window.
- Version floors (`engines`, `packageManager`) live in the repo, not in anyone's head — if you upgraded something and it isn't in a file, it didn't happen.
