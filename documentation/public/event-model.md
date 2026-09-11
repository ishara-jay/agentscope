# Event model

`@agentscope/contract` defines the canonical JSON vocabulary used between an
instrumented agent process and AgentScope. Every event has the same envelope:

| Field            | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| `event_id`       | Producer-generated UUID and ingest idempotency key             |
| `session_id`     | UUID for one end-to-end run                                    |
| `span_id`        | Producer-generated identifier for one agent, LLM, or tool span |
| `parent_span_id` | Parent span, or `null` for the root agent                      |
| `timestamp`      | Producer time as an ISO 8601 UTC value                         |
| `type`           | Event discriminator                                            |
| `payload`        | Data specific to the event type                                |

## Event types

| Type             | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `agent_started`  | Opens an agent span and records its name and optional input              |
| `agent_finished` | Closes an agent span with success/error and output/error detail          |
| `llm_called`     | Records one completed model call, usage, duration, prompt, and response  |
| `tool_called`    | Records one completed tool call, arguments, result, status, and duration |
| `delegated`      | Records the task a parent hands to a child agent                         |

Agent spans use a start/finish pair. LLM and tool spans use one completion event
that carries their duration. A delegation event sits on the parent agent span;
the child's `agent_started` event has that parent span as `parent_span_id`.

## Field naming

Contract fields use snake_case for TypeScript and JSON ergonomics. Where an
OpenTelemetry GenAI semantic convention has an equivalent, the mapping is
documented beside the Zod field. Future OTLP ingest translates dotted OTel
attributes at the edge instead of spreading them through the domain model.

## Authoritative definitions

- `packages/contract/src/events.ts` — event and ingest schemas
- `packages/contract/src/api.ts` — graph/read response schemas
- `packages/contract/src/prices.ts` — price-file schema
- `packages/contract/fixture.json` — complete example session

For the detailed span invariants and response shapes, see the
[trace contract design](../architecture/design/trace-contract.md).
