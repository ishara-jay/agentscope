# Product overview

## What AgentScope is

A **flight recorder for multi-agent LLM systems**: it captures what happened inside an agent session and replays it as a visual conversation graph — which agent delegated to which, which tools were called, carrying what context, at what latency and cost.

One-sentence pitch: _"Run your agents, watch the conversation graph draw itself live, click any node, and see the exact prompt behind that decision."_

## The problem

A single LLM call is easy to debug: one prompt in, one response out. A multi-agent system is a **distributed system whose components improvise**. An orchestrator delegates to a researcher agent, which calls three tools, hands results to a writer agent, which nondeterministically loops back and asks the researcher again. When the final answer is wrong, slow, or expensive, "what actually happened in this session?" has no good answer from flat logs — you end up grepping interleaved JSON blobs, mentally reconstructing a conversation tree.

The thing that needs to be seen is not a sequence of log lines; it is a **structure**: who delegated to whom, why, with what context, at what cost. Structures need a graph view and replay, not a log file — hence "flight recorder."

Market context (researched 2026-09): a large majority of enterprises want agent monitoring in production, and inadequate observability tooling is the most-cited barrier; traditional logging is widely acknowledged as insufficient for multi-step, tool-using, self-delegating agents.

## Core thesis

1. **Capture** — agents emit structured trace events (field names aligned with OpenTelemetry GenAI semantic conventions).
2. **Reconstruct** — the backend turns events into a conversation DAG: nodes are agent invocations and tool calls; edges are delegations and handoffs; latency, tokens, and dollar cost are annotated per node and rolled up per subtree.
3. **Replay** — the UI presents the session as a graph plus an ordered event list; clicking a node reveals the exact prompt, response, and cost behind that decision.

## Positioning

Langfuse, MLflow, Arize Phoenix, and Laminar exist and are well-funded. AgentScope does **not** compete on breadth. The defensible slice: **visual conversation-graph replay for multi-agent sessions** — the view the big platforms treat as secondary (they mostly render traces as nested waterfall lists). Narrow scope is also what makes the MVP buildable by 2 developers in 3 days.

AgentScope v1 is a compact, readable reference implementation, not a hosted platform: no multi-tenancy, no framework adapters, no prompt management.

## Demo story (the artifact that carries the project)

A ~30-second GIF: run the demo agents on a task → open AgentScope → the conversation graph draws itself live (researcher fans out into tool calls, hands off to the writer, cost counter ticking per node) → click one node → see the exact prompt behind that decision. That single view of an agent DAG _is_ the brand.

## Tech direction (agreed)

- Demo multi-agent app: 3 agents (orchestrator → researcher + writer), 2–3 tools, **google-genai SDK**
- Backend: **NestJS** ingest API + **PostgreSQL** event store, graph reconstruction layer
- Frontend: **React** with React Flow (+ dagre/elkjs layout), node detail panel, 2s polling for the live-draw effect
- Runs with one command: `docker compose up`
- Mono-repo layout (workspaces for backend / frontend / demo-agents / docs)
