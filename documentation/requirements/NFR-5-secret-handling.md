# NFR-5 — Secret handling

**Status:** Planned

## Requirement

- **NFR-5.1** Provider API keys come only from environment variables. They are
  never committed, persisted in trace events, or written to logs.
- **NFR-5.2** `.env.example` documents every required variable with safe
  placeholders.

## Acceptance evidence

- [ ] The Gemini adapter fails clearly when its key is absent and never includes
      it in errors or telemetry.
- [ ] `.env.example` contains names and descriptions but no usable credentials.
- [ ] Tests or review cover log and event redaction at provider boundaries.

## Related architecture

- [DD-6](../architecture/decisions.md)
