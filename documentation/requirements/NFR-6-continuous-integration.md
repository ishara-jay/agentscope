# NFR-6 — Continuous integration

**Status:** Implemented

## Requirement

- **NFR-6.1** GitHub Actions installs the pinned toolchain and runs build, lint,
  format check, typecheck, and tests on every pull request.
- **NFR-6.2** Graph reconstruction and cost rollup receive focused unit coverage
  because they contain the core transformation logic.

## Acceptance evidence

- [x] A committed workflow runs the same gate command documented for local use.
- [x] Repository branch protection requires the CI check before merging.
- [ ] Reconstruction and cost-rollup tests include normal and degraded inputs.

## Related architecture

- [Scaffolding design](../architecture/design/scaffolding.md)
- [Contributing](../public/contributing.md)
