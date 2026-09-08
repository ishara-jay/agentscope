# AgentScope — Dev Guide

Practical, step-by-step runbooks for day-to-day development. Requirements live in [../requirements/](../requirements/README.md), designs in [../design/](../design/README.md).

| Doc                                        | Contents                                                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [git-workflow.md](git-workflow.md)         | How a change reaches `main`: branch and commit naming, the gate command (and why `build` runs before `typecheck`), what a PR body needs, same-PR obligations, cross-review, squash-merge, rollback |
| [version-upgrades.md](version-upgrades.md) | How to upgrade pnpm (corepack + `packageManager` pin), Node (`engines` + CI), and dependencies (routine vs major), with verification and rollback per section                                      |
