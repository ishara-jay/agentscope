# Contributing and Git workflow

How a change travels to `main`: branch → PR → cross-review → merge. One step or
user story = one branch = one PR = one owner ([delivery plan](../architecture/delivery-plan.md),
[E0 working rules](../architecture/build-plan.md#working-rules-for-e0)).

```
main ────●──────────────────────────────────────●──▶   (always green)
          \                                    /
           ●──●──●  feat/<topic>  ──PR──▶ cross-review ──▶ squash-merge
```

---

## 1. Start a branch

Always from a fresh `main`:

```bash
git switch main && git pull
git switch -c <type>/<short-topic>     # e.g. feat/e0-step4-emitter, fix/ingest-dedupe, docs/git-workflow
```

`<type>` is the same word the commit message will start with (next section). Keep the topic to a few words and put the step or story in it when there is one.

## 2. Work and commit

Commit messages follow the pattern already in the history — `<type>: <what> (<where it fits>)`:

```
feat: emitter package — API surface with B1 stubs (E0 step 4)
chore: shared TS/ESLint/Prettier config (E0 step 2)
docs: implementation-docs section
```

| `<type>` | Use for                           |
| -------- | --------------------------------- |
| `feat`   | new behaviour or a new package    |
| `fix`    | a bug fix                         |
| `chore`  | tooling, config, dependencies, CI |
| `docs`   | documentation only                |

Small commits on the branch are fine — the PR is squash-merged, so `main` gets exactly one commit per PR either way.

## 3. Run the gates before you push

```bash
pnpm install                                                    # if any package.json changed
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

`build` runs first on purpose: a package that depends on another workspace package (emitter → contract) typechecks against the dependency's `dist/`, so on a fresh clone `typecheck` fails until `build` has run once. `pnpm format` fixes formatting; everything else you fix by hand.

## 4. Open the PR

```bash
git push -u origin <branch>
gh pr create --base main              # prompts for title and body; --fill takes them from the commit
```

A good PR body has three parts: **what & why** (one paragraph; link the step,
story, or FR), **see it work** (the commands the reviewer runs and the matching
[acceptance evidence](../requirements/README.md)), and **review asks** (the one
or two decisions you want a second opinion on). Same-PR obligations:

- Behaviour changed → the matching requirement and public developer doc are
  updated in the same PR when their truth changed.
- Contract (`packages/contract`) changed → both devs agree **and** `fixture.json`
  changes in the same commit ([DD-5](../architecture/decisions.md)).
- Toolchain or version changed → follow [version-upgrades.md](version-upgrades.md).

## 5. Cross-review and merge

Every PR is reviewed by the other developer before merge — 100%, no exceptions
([delivery plan](../architecture/delivery-plan.md)).

- **Reviewer:** pull the branch, run "see it work", read every line; approve or request changes the same day.
- **Author:** address comments with new commits, not by rewriting reviewed history.
- **Merge:** **Squash and merge**, keeping the commit title in the `<type>: …` form above. `main` stays one commit per PR, linear, and revertable. Delete the branch after merge.

If `main` moved while you were working:

```bash
git fetch origin
git rebase origin/main      # before review — then push with --force-with-lease
git merge origin/main       # during or after review — keeps the reviewer's comments anchored
# either way: re-run the gates before pushing
```

## Rollback

A merged PR is undone with `git revert <its squash commit>` on a new branch, through the same PR flow. Never rewrite `main`.

## Rules that apply to every change

- **One owner, one reviewer, one PR per step or story** — small enough to review in minutes.
- **`main` is always green:** the gates pass locally before the PR opens. CI is
  tracked by [NFR-6](../requirements/NFR-6-continuous-integration.md); until it
  lands, local verification and cross-review are the gates.
- **Docs travel with code:** affected requirements and public docs are updated in
  the PR that makes them stale. Architecture changes only when direction changes.
