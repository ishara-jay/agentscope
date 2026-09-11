# System architecture

AgentScope is a flight recorder for multi-agent systems. An instrumented agent
run emits typed events; the backend stores those facts and reconstructs a
conversation graph; the UI presents the graph, event order, prompts, responses,
latency, token use, and derived cost.

```text
demo agents
    │ typed trace events
    ▼
@agentscope/emitter ──POST /events──▶ NestJS backend ──append──▶ PostgreSQL
                                          │
                                          │ reconstruct + price at read time
                                          ▼
                                  session and graph APIs
                                          │
                                          ▼
                                     React viewer
```

Solid concepts above are the target MVP. The current implementation status is
kept in the [requirements index](../requirements/README.md); public docs never
pretend a planned boundary is already available.

## Components

| Component       | Responsibility                                                                                | Location                  |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| Shared contract | Zod schemas for events, graph responses, price files, and the canonical fixture               | `packages/contract`       |
| Emitter         | Wrap agent, LLM, tool, and delegation work; batch trace events without breaking the agent run | `packages/emitter`        |
| Demo agents     | Deterministic orchestrator/researcher/writer example behind a provider-neutral `LlmClient`    | `apps/demo-agents`        |
| Backend         | Validate ingestion, append events, reconstruct sessions, and expose read APIs                 | `apps/backend`            |
| Frontend        | Render the session list, graph, ordered events, and detail panel                              | `apps/frontend` (planned) |

## Architectural boundaries

1. **The contract is canonical.** Producers and consumers import the same Zod
   definitions; runtime validation happens at the backend edge.
2. **The write path stores facts.** Events and token counts are append-only.
   Prices and graph rollups are derived when read.
3. **Provider details stop at the demo adapter.** Agent orchestration depends on
   the small `LlmClient` interface, not a vendor SDK.
4. **Protocol before SDK family.** JSON over HTTP is the v1 paved road. A future
   OTLP adapter translates external dialects into the canonical model.
5. **Bad telemetry degrades the view, not the service.** Unknown prices,
   unattached spans, and unfinished sessions are explicit states.

The detailed span and wire shapes live in the
[trace contract design](design/trace-contract.md). Accepted trade-offs live in
the [decision log](decisions.md).
