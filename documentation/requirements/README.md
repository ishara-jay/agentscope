# Requirements

This is the product contract. Each top-level requirement has one document with
its detailed statements, acceptance evidence, status, and links to relevant
architecture. Requirement IDs remain stable even if files are renamed.

## Functional requirements

| ID   | Requirement                                          | Status      |
| ---- | ---------------------------------------------------- | ----------- |
| FR-1 | [Trace capture](FR-1-trace-capture.md)               | In progress |
| FR-2 | [Ingest and storage](FR-2-ingest-storage.md)         | Planned     |
| FR-3 | [Graph reconstruction](FR-3-graph-reconstruction.md) | Planned     |
| FR-4 | [Web interface](FR-4-web-interface.md)               | Planned     |
| FR-5 | [Demo application](FR-5-demo-application.md)         | In progress |

## Non-functional requirements

| ID    | Requirement                                               | Status        |
| ----- | --------------------------------------------------------- | ------------- |
| NFR-1 | [One-command boot](NFR-1-one-command-boot.md)             | In progress   |
| NFR-2 | [Contract-first development](NFR-2-contract-first.md)     | In progress   |
| NFR-3 | [Readability over generality](NFR-3-readability.md)       | Active policy |
| NFR-4 | [MVP graph performance](NFR-4-graph-performance.md)       | Planned       |
| NFR-5 | [Secret handling](NFR-5-secret-handling.md)               | Planned       |
| NFR-6 | [Continuous integration](NFR-6-continuous-integration.md) | Planned       |

Status means `Planned`, `In progress`, `Complete`, or `Active policy`. A
requirement is complete only when its acceptance evidence is present in the
repository.

## Editing requirements

Start new requirements from [`_template.md`](_template.md). Change the smallest
possible file. If the change also reverses or introduces a cross-cutting design
choice, add a decision to the
[architecture decision log](../architecture/decisions.md); otherwise do not
touch the architecture section.
