# FR-2 — Ingest and storage

**Status:** Planned

## Requirement

- **FR-2.1** `POST /events` accepts one event or a batch of at most 100, validates
  each event against the shared contract, and persists valid events to
  PostgreSQL.
- **FR-2.2** Storage is append-only. Existing event facts are never updated.
- **FR-2.3** Invalid events receive a 4xx response with a reason. Valid events in
  a mixed batch are still stored, and repeated `event_id` values are reported as
  duplicates rather than stored twice.

## Acceptance evidence

- [ ] Endpoint tests cover a valid batch, mixed validity, duplicate IDs, and an
      out-of-contract request.
- [x] A migration creates the append-only events table with a unique
      `event_id`.
- [ ] An integration test reads back all accepted events without mutation.

## Related architecture

- [System architecture](../architecture/system-architecture.md)
- [Trace contract design](../architecture/design/trace-contract.md)
- [DD-5 and DD-10](../architecture/decisions.md)
