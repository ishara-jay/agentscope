# AgentScope repository instructions

## Project context

AgentScope is an early TypeScript monorepo for capturing multi-agent trace
events and reconstructing them as a conversation graph. Read
`documentation/architecture/system-architecture.md` and the affected file in
`documentation/requirements/` before changing behavior.

## Working agreements

- Use Node.js 24+ and the pnpm version pinned by `packageManager`.
- Keep wire shapes in `packages/contract`; infer TypeScript types from the Zod
  schemas instead of redefining them.
- Preserve the append-only event model. Store token facts and derive cost at
  read time.
- Keep provider-specific code behind `LlmClient`.
- Do not add speculative framework layers or features without a current
  requirement.
- Never commit API keys or include secrets in events, fixtures, logs, or tests.

## Before editing a scoped area

- Read `packages/AGENTS.md` before changing a shared package.
- Read `apps/AGENTS.md` before changing an application.
- Read `documentation/AGENTS.md` before changing documentation.

## Verification

Run the narrowest relevant tests while iterating. Before handing off a code
change, run from the repository root:

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

Build comes first because workspace consumers resolve dependency types from
generated `dist/` directories on a clean checkout.

## Documentation changes

- Change only the requirement file whose behavior changed.
- Update public docs in the same change when setup, commands, API behavior, or a
  public contract changes.
- Add an architecture decision only for a cross-cutting or hard-to-reverse
  choice. Supersede previous decisions instead of rewriting them.

## Code review rules

- Flag duplicate contract types outside `packages/contract`.
- Flag stored or hard-coded dollar costs; prices must be derived from tokens.
- Flag telemetry failures that can fail the wrapped agent task.
- Flag provider SDK types that escape the adapter boundary.
- Flag claims in public docs that describe planned behavior as implemented.
