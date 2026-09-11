# Shared package instructions

These rules apply under `packages/` in addition to the repository instructions.

- `contract` is the only definition of wire shapes. Update schemas, inferred
  types, fixture, and contract tests together.
- Contract changes require compatibility review across emitter, backend, demo,
  and future frontend consumers.
- `emitter` wraps callbacks without changing their return values or errors.
  Telemetry failures may warn or be silent but must not fail agent work.
- Keep emitter transport bounded and flushable; do not add runtime validation
  that duplicates the backend edge.
- Run the affected package tests plus all workspace typechecks after changing a
  public export.
