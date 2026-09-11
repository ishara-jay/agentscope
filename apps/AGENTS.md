# Application instructions

These rules apply under `apps/` in addition to the repository instructions.

- `backend` owns transport validation, persistence, reconstruction, and HTTP
  behavior. Import shared wire schemas from `@agentscope/contract`.
- `demo-agents` owns example orchestration. Keep the agent loop hand-written,
  deterministic under the fake provider, and independent of provider SDK types.
- A future `frontend` consumes contract response types and must not reconstruct
  or re-price sessions in the browser.
- Read configuration and secrets from environment variables. Tests must not
  require live providers or the public internet.
- Add focused tests beside behavior changes and update the matching requirement
  document when its acceptance evidence changes.
