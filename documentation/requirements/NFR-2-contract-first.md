# NFR-2 — Contract-first development

**Status:** In progress

## Requirement

- **NFR-2.1** Each wire shape has one authoritative Zod schema in
  `@agentscope/contract`. TypeScript types are inferred from it, backend runtime
  validation uses it, and tests validate the canonical `fixture.json` against
  it.
- **NFR-2.2** The fixture represents one complete fake session so read- and
  write-path development can proceed independently.

## Acceptance evidence

- [x] Event, read-API, and price schemas live in `packages/contract`.
- [x] `packages/contract/fixture.json` contains a complete session.
- [x] Contract tests validate every fixture event and cross-event span rules.
- [ ] The ingest endpoint uses the same event schema for runtime validation.

Verify with:

```bash
pnpm --filter @agentscope/contract test
```

## Related architecture

- [Trace contract design](../architecture/design/trace-contract.md)
- [DD-5](../architecture/decisions.md)
