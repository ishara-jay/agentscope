# FR-3 — Graph reconstruction

**Status:** Planned

## Requirement

- **FR-3.1** `GET /sessions` lists session ID, start time, status, root agent,
  token totals, and cost totals.
- **FR-3.2** `GET /sessions/:id/graph` returns agent, tool, and LLM nodes plus
  containment and delegation edges. Nodes include status, timing, tokens, cost,
  and detail data.
- **FR-3.3** Cost is derived at read time from token counts and a runtime-loaded
  JSON price file. Dollar amounts are never persisted.
- **FR-3.3.1** Unknown models retain their token counts, expose unknown cost, and
  mark rollups partial; they never break the response.
- **FR-3.4** Token and cost totals roll up for each agent subtree and the session.
- **FR-3.5** The graph response includes the flat, time-ordered source events.
- **FR-3.6** Broken streams degrade gracefully: orphans appear under a synthetic
  `unattached` node and sessions without a finish event remain `running`. The
  server does not buffer, reorder, or guess missing data in v1.

## Acceptance evidence

- [ ] Reconstruction tests cover the canonical fixture, nested delegation,
      subtree rollups, and stable event ordering.
- [ ] Tests cover an orphan, a running session, an unknown model, and partial
      cost rollups.
- [ ] Endpoint tests validate both read responses against the shared contract.

## Related architecture

- [Trace contract design](../architecture/design/trace-contract.md)
- [DD-8 and DD-10](../architecture/decisions.md)
