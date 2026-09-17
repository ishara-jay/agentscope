# NFR-1 — One-command boot

**Status:** In progress

## Requirement

- **NFR-1.1** At MVP completion, `docker compose up` starts PostgreSQL, backend,
  frontend, and the demo-agent runner with documented defaults and health
  checks.

## Acceptance evidence

- [x] Docker Compose starts a persistent PostgreSQL service with a health check.
- [x] Compose builds and starts the backend and frontend alongside PostgreSQL.
- [ ] A clean-clone smoke test reaches the UI and runs the demo without manual
      service setup beyond environment configuration. The demo runner remains
      CLI-based until the chat service is delivered in Step 8.4.

## Related architecture

- [Scaffolding design](../architecture/design/scaffolding.md)
- [Monorepo build plan](../architecture/build-plan.md)
