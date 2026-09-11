# NFR-3 — Readability over generality

**Status:** Active policy

## Requirement

- **NFR-3.1** AgentScope is a reference implementation. Prefer the smallest
  obvious solution that satisfies current requirements over speculative
  abstractions.
- **NFR-3.2** Cross-cutting trade-offs are recorded in the architecture decision
  log; local implementation details remain close to code and tests.

## Acceptance evidence

- [ ] Pull-request review confirms new abstractions serve a current requirement.
- [ ] Any new hard-to-reverse system choice links to a decision-log entry.

This requirement is continuously enforced and is never “finished” by a single
feature.

## Related architecture

- [Architecture change policy](../architecture/README.md#change-policy)
- [Architecture decision log](../architecture/decisions.md)
