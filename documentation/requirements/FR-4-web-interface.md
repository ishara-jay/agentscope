# FR-4 — Web interface

**Status:** Planned

## Requirement

- **FR-4.1** The session list shows status and totals and opens a selected
  session.
- **FR-4.2** The session view renders a laid-out DAG with visibly different
  agent, tool, and LLM nodes and badges for latency and cost.
- **FR-4.3** While a session is running, the UI polls every two seconds and adds
  new graph data without a full-page refresh.
- **FR-4.4** Selecting a node shows its exact prompt/response or tool
  arguments/result, token counts, cost, and timing.
- **FR-4.5** An ordered event list appears beside the graph; selecting an event
  highlights its node.

## Acceptance evidence

- [ ] Component tests cover the session list, node types, selection, detail
      panel, and event-to-node highlighting.
- [ ] A polling test proves running graphs refresh every two seconds and stop
      polling when terminal.
- [ ] The canonical fixture renders as a readable graph.

## Related architecture

- [System architecture](../architecture/system-architecture.md)
- [MVP scope](../architecture/mvp-scope.md)
