# AgentScope documentation

Documentation has three owners. Pick the section based on the question you are
answering; do not copy the same fact into several sections.

| Section                                   | Answers                                                                  | Change policy                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture](architecture/README.md)    | Why are we building this, how is it shaped, and what did we decide?      | Update when direction or a cross-cutting design changes. Record new decisions in the log; supersede old decisions instead of rewriting history. |
| [Requirements](requirements/README.md)    | What observable behavior must the product provide?                       | One file per requirement. A feature PR normally changes only its requirement file.                                                              |
| [Public developer docs](public/README.md) | How can a developer install, run, use, or contribute to what exists now? | Describe shipped behavior only. Update beside the code that changes the developer experience.                                                   |

## Source-of-truth rule

- Architecture owns rationale, boundaries, roadmap, and decisions.
- Requirements own acceptance criteria and delivery status.
- Public docs own commands and externally useful reference material.
- Source code and tests own implementation details. Link to them; do not mirror
  them line by line in Markdown.

Repository-wide AI-assisted development guidance lives in
[`/AGENTS.md`](../AGENTS.md). Documentation-specific guidance lives in
[`documentation/AGENTS.md`](AGENTS.md).
