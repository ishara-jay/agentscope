# Documentation instructions

These instructions apply to everything under `documentation/`.

## Keep one source of truth

- Put rationale, system boundaries, roadmap, and accepted decisions in
  `architecture/`.
- Put testable product behavior in `requirements/`, with one file per top-level
  FR or NFR.
- Put installation, usage, reference, and contribution material in `public/`.
- Link across sections instead of copying paragraphs.

## Change discipline

- For ordinary feature work, update the affected requirement and public doc only.
- Add a decision-log entry only for a cross-cutting or hard-to-reverse choice.
- Supersede decision entries; do not erase historical rationale.
- Public docs must distinguish shipped behavior from planned behavior.
- Keep requirement IDs stable and acceptance criteria observable.
- After moving or renaming a document, search the whole repository for old links.

## Style

- Lead with plain language and short sections.
- Prefer one small diagram or table when it clarifies relationships.
- Commands must be copy-pasteable from the repository root.
- Verify commands against the current package scripts before documenting them.
