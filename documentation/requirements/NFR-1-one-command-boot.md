# NFR-1 — One-command boot

**Status:** In progress

## Requirement

- **NFR-1.1** At MVP completion, `docker compose up` starts PostgreSQL, backend,
  frontend, and the demo-agent runner with documented defaults and health
  checks.

## Acceptance evidence

- [x] Docker Compose starts a persistent PostgreSQL service with a health check.
- [ ] Compose builds and starts the backend, frontend, and demo runner.
- [ ] A clean-clone smoke test reaches the UI and runs the demo without manual
      service setup beyond environment configuration.

## Related architecture

- [Scaffolding design](../architecture/design/scaffolding.md)
- [Monorepo build plan](../architecture/build-plan.md)
