# AgentScope — Implementation Docs

One doc per functional-requirement group. Each explains **what was built, how it works, and how to see it working** — in simple terms. Requirements say _what must be true_ ([../requirements/03-functional-requirements.md](../requirements/03-functional-requirements.md)); design says _what we intended_ ([../design/](../design/README.md)); these docs say _what exists_.

## Status

| Doc                             | Covers                                             | Status                             |
| ------------------------------- | -------------------------------------------------- | ---------------------------------- |
| FR-1-capture                    | Emitter helper: spans, batching, fire-and-forget   | ⏳ not started                     |
| FR-2-ingest                     | `POST /events`: validation, partial accept, dedupe | ⏳ not started                     |
| FR-3-graph                      | Reconstruction, rollups, cost, read API            | ⏳ not started                     |
| FR-4-ui                         | Session list, DAG view, detail panel, live polling | ⏳ not started                     |
| FR-5-demo                       | Demo agents, `LlmClient` port, fake/Gemini         | ⏳ not started                     |
| NFR-scaffolding                 | Monorepo, shared config, CI, one-command boot      | 🔨 in progress (E0 steps 1–4 done) |
| [NFR-contract](NFR-contract.md) | The shared schema package + fixture                | ✅ done (E0 step 3)                |

**Legend:** ⏳ not started · 🔨 in progress · ✅ done · Status flips when the epic's PRs merge.

## The rules (pretty for the eye, easy for the brain)

1. **Start from the template** — copy [`_template.md`](_template.md); keep its section order.
2. **Simple terms first.** Explain it the way you'd explain it aloud; jargon only after the plain version. If a sentence needs re-reading, rewrite it.
3. **One diagram beats three paragraphs.** A small ASCII flow or tree per doc, near the top.
4. **Short.** A doc is a tour, not a mirror of the code — target one screen, two max. Link out to design docs and DDs instead of repeating them.
5. **Every doc ends with "see it work"** — the exact commands (and expected output) that prove the feature is alive. If a reader can't verify it in two minutes, the doc is missing its point.
6. **Update on change.** A PR that changes behavior updates the matching doc in the same PR — stale implementation docs are worse than none.
