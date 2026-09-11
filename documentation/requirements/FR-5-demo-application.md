# FR-5 — Demo application

**Status:** In progress

## Requirement

- **FR-5.1** A runnable demo has an orchestrator delegate to researcher and
  writer agents; the researcher uses two or three tools. The control loop stays
  hand-written instead of depending on an agent framework.
- **FR-5.2** The complete run is instrumented through the emitter, with LLM
  instrumentation at the `LlmClient` boundary.
- **FR-5.3** A developer can trigger the demo from the CLI and, once the web app
  exists, from a “run demo task” action in the UI.
- **FR-5.4** Model access uses a minimal provider-neutral `LlmClient`. Provider
  selection comes from `LLM_PROVIDER`; the MVP runtime adapter uses
  google-genai/Gemini, while a deterministic fake supports local tests and
  development.

## Acceptance evidence

- [x] The deterministic fake workflow, three agents, two tools, and CLI exist.
- [x] Tests exercise orchestration without network access.
- [ ] The emitter produces a complete session from a demo run.
- [ ] The Gemini adapter reads its API key only from the environment.
- [ ] The UI can trigger a run.

## Related architecture

- [Product overview](../architecture/product.md)
- [DD-6 and DD-7](../architecture/decisions.md)
