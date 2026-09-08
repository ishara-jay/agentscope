# AgentScope — Requirements

This folder captures the agreed project definition before any code is written.

| Doc                                                            | Contents                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-overview.md](01-overview.md)                               | Problem statement, core thesis, positioning                                                                                                          |
| [02-mvp-scope.md](02-mvp-scope.md)                             | 3-day MVP scope: what's in, what's cut, definition of done                                                                                           |
| [03-functional-requirements.md](03-functional-requirements.md) | Functional & non-functional requirements for the MVP                                                                                                 |
| [04-team-plan.md](04-team-plan.md)                             | Write-path/read-path split, epics for user-story breakdown, pairing + cross-review, day-by-day plan                                                  |
| [05-roadmap.md](05-roadmap.md)                                 | Deliberately deferred features and the reasoning                                                                                                     |
| [06-design-decisions.md](06-design-decisions.md)               | Architecture decisions with alternatives considered (NestJS, JSON/protobuf, emitter, contract, LLM provider, cost model, pnpm, PostgreSQL, batching) |
| [07-monorepo-plan.md](07-monorepo-plan.md)                     | E0 scaffolding: tooling choices, target structure, 10 build steps (one PR each) with owners and done-when checks                                     |

Long-range strategy lives outside the sprint contract: [../VISION.md](../VISION.md).

Status: **draft** — pending event-schema and API design (next step).
Repo intent: mono-repo (backend, frontend, demo-agents, docs as workspaces). Scaffolding not yet created; remote origin to be added.
