# AgentScope — Vision (post-MVP, explicitly firewalled from the 3-day scope)

Where AgentScope could go if it earns the right to. Nothing in this document changes the MVP scope, the definition of done, or the roadmap's ordering — it exists so the long-range thinking is on paper instead of in heads, and so every future step can be tested against a stated strategy.

## The ambition

Evolve AgentScope from a portfolio project into a **client-agnostic monitoring and observability framework for multi-agent platforms** — any instrumented agent system, any language, any framework, rendered and understood through AgentScope.

## The honest market read (researched 2026-09)

- **The space is crowded at the platform level.** Langfuse (MIT, self-hostable leader), Arize Phoenix (source-available), Laminar (Apache 2.0, agents-first), Comet Opik, OpenObserve, plus closed platforms (LangSmith, Braintrust) and the giants bolting on LLM observability. Two developers do not out-platform that field.
- **"Client-agnostic" has one meaning in practice: speaks OpenTelemetry.** The OTel GenAI semantic conventions cover agent runs, tool executions, and memory operations — but are **pre-stable** (no 1.0, names may change; moved to a dedicated fast-moving repo in June 2026). Inventing our own instrumentation standard is dead on arrival; riding the standard means accepting dialect churn.
- **The named gaps are our slice.** Practitioners' recurring complaints about incumbents: very long traces (thousands of spans), non-deterministic control flow (trace shape changes every run), nested causality tracking. All three are symptoms of rendering agent sessions as _waterfall lists_ — a visualization inherited from microservice tracing that collapses under improvised delegation.

## The strategic frame: "Grafana of agent traces"

Not "compete with Langfuse." Grafana won by being the best **lens** over everyone else's data, without owning storage or collection. The analogous wedge:

> AgentScope is the best multi-agent session viewer — conversation-graph reconstruction, replay, and session diff — able to ingest OTLP directly, and eventually to sit on top of existing stores (a Langfuse/ClickHouse backend, any OTLP-compatible source).

This is a wedge two people can hold: visualization is the incumbents' secondary concern and our only one.

**Why our architecture already fits this** (decided for local reasons, validated by the market read):

- The anti-corruption layer (DD-4 discussion) quarantines dialect churn — pre-stable conventions hit one adapter, never the core.
- The canonical internal model means the viewer never cares whose SDK produced the spans.
- OTel-aligned field naming (design 02) makes convergence a mapping exercise.

## Sequenced path, with go/no-go gates

| Stage    | What ships                                                       | Gate to proceed                                                                    |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| v1 (now) | MVP + launch write-up                                            | External traction: stars, issues from strangers, anyone rendering their own traces |
| v1.2     | OTLP ingest — "client-agnostic" becomes literally true           | Same signals, from non-JS users specifically                                       |
| v1.3+    | Dialect adapters for 1–2 major frameworks (refuse the long tail) | Sustained external use; contributions                                              |
| v2       | Embeddable / standalone viewer over existing stores              | Only with real adoption; this is the framework claim                               |

**The gate rule:** progression is decided by external traction, never internal enthusiasm. Ship, publish, let the response allocate the next month.

## Standing decisions the vision implies

- **License: MIT or Apache 2.0.** Adoption is the entire game; restrictive licensing (cf. Phoenix's Elastic license, held against it in comparisons) would kill the wedge.
- **Depth over breadth, permanently.** Replay + diff + delegation semantics is a product; a graph render is a feature an incumbent can clone in a quarter. The moat, if any, is being _deep_ on multi-agent sessions.
- **Never own instrumentation.** OTel SDKs and existing instrumentation libraries are the capture layer (per DD-4); our emitter remains a v1 convenience, not a strategic asset.
- **Viewer-first positioning caps monetization — accepted.** This is credibility-first. If a product emerges, it emerges from adoption, not from a business plan written today.

## Risks

- An incumbent ships a graph view (mitigation: depth, above).
- Convention churn outpaces the adapter (mitigation: support the OTel conventions + at most two frameworks).
- The classic trap: building v2 before v1 has users. This document's gates exist precisely to prevent that — **if the MVP isn't shipped, this file is fiction.**
