# Architecture, design, and direction

This section contains the durable project context. It explains the product,
system boundaries, delivery direction, and the decisions behind them. It does
not track every implementation edit.

## Start here

1. [Product overview](product.md) — problem, pitch, scope, and technology direction.
2. [System architecture](system-architecture.md) — components, data flow, and boundaries.
3. [MVP scope](mvp-scope.md) — the deliberately small first release.
4. [Roadmap](roadmap.md) — ordered work that is explicitly outside the MVP.
5. [Vision](vision.md) — long-range positioning and go/no-go gates.
6. [Architecture decision log](decisions.md) — accepted trade-offs and their rationale.

## Delivery and detailed designs

- [Delivery plan](delivery-plan.md) — ownership and timeboxes for the original MVP sprint.
- [Monorepo build plan](build-plan.md) — the staged E0 scaffolding plan.
- [Scaffolding design](design/scaffolding.md) — implementation drafts for workspace infrastructure.
- [Trace contract design](design/trace-contract.md) — events, spans, APIs, fixture, and emitter design.

## Change policy

- A local implementation choice belongs with the code and tests.
- A behavior change belongs in one requirement document.
- A cross-cutting or hard-to-reverse choice gets a new decision-log entry.
- When a decision changes, mark the old entry `Superseded by DD-n` and add a new
  entry. Do not edit history until the old rationale disappears.
- Roadmap changes do not silently alter MVP requirements.
