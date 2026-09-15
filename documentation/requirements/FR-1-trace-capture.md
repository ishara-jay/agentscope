# FR-1 — Trace capture

**Status:** In progress

## Requirement

- **FR-1.1** A TypeScript emitter exposes wrappers that record
  `agent_started`, `llm_called`, `tool_called`, `delegated`, and
  `agent_finished` events.
- **FR-1.2** Every event carries `session_id`, `span_id`, nullable
  `parent_span_id`, timestamp, and its event-specific payload. Payloads include
  the prompt/response, tool arguments/result, model, token counts, and duration
  where relevant.
- **FR-1.3** Ergonomic snake_case contract fields map to equivalent OpenTelemetry
  GenAI semantic-convention names at the future OTLP boundary. Dotted OTel names
  do not leak into the TypeScript domain model.
- **FR-1.4** Emission failures do not crash or block an agent run. Normal
  operation is fire-and-forget with a local warning; an explicit `flush()` lets
  a CLI wait at shutdown.

## Acceptance evidence

- [x] The public wrapper API exists in `packages/emitter` and preserves callback
      results and errors.
- [ ] Wrapper tests prove all five event types have correct span relationships.
- [ ] Batching tests prove events are posted to the configured endpoint.
- [ ] Transport-failure tests prove agent work still completes.

## Related architecture

- [Trace contract design](../architecture/design/trace-contract.md)
- [DD-3 and DD-11](../architecture/decisions.md)
