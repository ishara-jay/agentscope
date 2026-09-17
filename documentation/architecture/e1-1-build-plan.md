# E1.1 build plan — event-producing emitter wrappers

This plan expands the E1.1 event-producing emitter-wrapper milestone into an
implementation-ready change list. The canonical behavior remains in
[FR-1](../requirements/FR-1-trace-capture.md), and the event schemas remain in
`@agentscope/contract`.

## Outcome

After this change, every emitter wrapper constructs correctly correlated
`TraceEvent` values while preserving the wrapped callback's return value or
thrown value. Tests can observe those events through an internal delivery seam
with deterministic IDs and clocks. Network delivery, batching, retry policy,
and timer-driven flushing remain E1.2 work.

The implementation must produce these lifecycle sequences:

```text
agent success: agent_started -> callback -> agent_finished(success)
agent failure: agent_started -> callback throws -> agent_finished(error) -> same throw
delegation:    delegated(parent) -> agent_started(child) -> ... -> agent_finished(child)
LLM success:   monotonic start -> callback -> llm_called(completion)
tool success:  monotonic start -> callback -> tool_called(success, completion)
tool failure:  monotonic start -> callback throws -> tool_called(error, completion) -> same throw
```

## Decisions to ratify before coding

These are the remaining E1.1 seams from the joint contract review. They do not
change a wire schema.

1. `LlmCallMeta` gains a required `prompt`, derived from
   `LlmCalled['payload']` alongside `model` and `provider`. The demo passes a
   deterministic JSON serialization of the complete `LlmRequest`.
2. `LlmCallResultLike` structurally mirrors the normalized provider result:
   optional `text`, optional normalized `toolCalls`, and required token usage.
   A text-only result records its text. A result containing tool calls records
   `JSON.stringify(toolCalls)` in their existing order. A result containing
   neither records an empty response string.
3. A rejected LLM callback does not emit `llm_called`. The current schema has
   no LLM error status and requires response and usage fields that do not exist
   on rejection. The rejection still propagates unchanged, and an unhandled
   rejection is represented by the enclosing `agent_finished(error)` event.
   Adding a failed-LLM wire shape is outside E1.1 and requires a separate
   contract decision.
4. A rejected tool callback emits `tool_called` with `status: "error"` and
   `result: { error: message }`, then rethrows the original value. For an
   `Error`, `message` is `Error.message`; for a thrown string, it is that string;
   all other thrown values use `"Unknown error"`. Never record a stack, cause,
   or arbitrary thrown object.
5. Only a string returned by an agent callback becomes
   `agent_finished.payload.output`. Other return types remain untouched but do
   not become wire content.

## Internal shape

Keep the public wrap-style API unchanged apart from the richer LLM metadata and
result constraint. Add one small internal runtime dependency object in
`packages/emitter/src/session.ts`:

```ts
type SessionRuntime = {
  wallNow: () => Date;
  monotonicNow: () => number;
  newId: () => string;
  delivery: {
    emit: (event: TraceEvent) => void;
    flush: () => Promise<void>;
  };
  warn: (message: string) => void;
};
```

Expose the runtime-aware session factory only from `session.ts` for colocated
tests; do not export it from the package entry point. `startSession()` supplies
the production clock and UUID functions. Its E1.1 delivery implementation is a
deliberate no-op placeholder; E1.2 replaces only that adapter with the bounded
queue and HTTP transport. This keeps event construction independent from
delivery without adding a public test-only option or calling `fetch` early.

Use the platform primitives already available on Node 24:

- `new Date()` for producer wall-clock timestamps;
- `performance.now()` for elapsed durations;
- `crypto.randomUUID()` for session, span, and event IDs.

Every event gets a fresh event ID. A session gets one session ID. Each root
agent, delegated child, LLM call, and tool call gets a fresh span ID. A
`delegated` event is the exception: it is recorded on the current parent agent
span and uses that agent's own `parent_span_id`, matching the canonical fixture.

Wrap event construction and `delivery.emit()` in a best-effort recorder. A
telemetry-side exception may issue one generic warning when `onError` is
`"warn"`, but it must not expose event content or the caught object and must
never alter agent execution. `"silent"` suppresses the warning. Apply the same
policy when `delivery.flush()` rejects.

## Code changes

### 1. Complete the public emitter types

Change `packages/emitter/src/types.ts`:

- derive `LlmCallMeta` from `model`, `provider`, and `prompt` in the contract;
- extend `LlmCallResultLike` with the normalized `text` and `toolCalls` fields
  required to create the contract's response string;
- keep token names in the existing normalized camel-case form because this is
  the `LlmClient` seam, not a second wire contract;
- update API comments to state completion-event and error behavior.

Do not redefine a `TraceEvent` or payload interface in the emitter. Event
objects must be typed with the schemas' inferred types from
`@agentscope/contract`.

### 2. Replace the wrapper stubs with lifecycle helpers

Change `packages/emitter/src/session.ts`:

- create the session ID once in the session factory;
- retain `span_id` and `parent_span_id` in each `AgentSpanImpl` instance instead
  of using global mutable state or `AsyncLocalStorage`;
- add one envelope helper that stamps a fresh event ID, the session ID, span
  relationship, and `wallNow().toISOString()`;
- add one `runAgent` helper used by both `Session.agent()` and `delegate()` so
  root and child agents cannot drift in lifecycle behavior;
- conditionally add optional payload keys rather than assigning `undefined`;
- use `try`/`catch`, emit the terminal event before returning or rethrowing, and
  rethrow the exact caught value.

Agent timing and parentage must be explicit:

- root `agent_started` and `agent_finished` use a new span with
  `parent_span_id: null`;
- a child agent uses a new span whose `parent_span_id` is the delegating agent's
  span ID;
- the `delegated` event is emitted first on the parent span, then the child
  agent helper emits `agent_started` immediately before invoking its callback;
- each invocation emits exactly one `agent_started` and one
  `agent_finished`, including when nested work rejects.

### 3. Implement completion events with two clocks

In `AgentSpanImpl.llmCall()` and `toolCall()`:

1. Allocate the child span ID.
2. Read `monotonicNow()` immediately before invoking the callback.
3. Await the callback.
4. On settlement, read the monotonic clock for `duration_ms` and the wall clock
   for the completion event's `timestamp`.
5. Clamp elapsed time to zero defensively if an injected clock violates the
   monotonic contract.

An LLM success event records the metadata, token usage, and normalized response
without changing the returned object. A tool success event records the original
arguments and result. A tool failure records the safe error result described
above. If building or handing off any telemetry event fails, return or rethrow
exactly what the callback produced.

Do not derive duration from wall-clock timestamps. A wall clock moving backward
during a call must affect only the event timestamp, not create a negative
duration.

### 4. Make existing demo callers satisfy the richer LLM seam

The required `prompt` property changes a public package type, so keep all
workspace consumers compiling in the same PR:

- add `apps/demo-agents/src/llm/serialization.ts` with a small
  `serializeLlmRequest(request)` helper using `JSON.stringify`;
- add a focused test proving repeated serialization is stable and retains
  messages, tools, and tool-call IDs;
- in `agents/orchestrator.ts`, `agents/researcher.ts`, and `agents/writer.ts`,
  construct each `LlmRequest` before calling `llmCall` and pass its serialized
  form as `prompt`;
- preserve the current model selection and orchestration in E1.1. Moving all
  model calls behind one helper and resolving the model from run configuration
  remains E1.4.

No provider SDK type may enter the emitter API. The structural
`LlmCallResultLike` must remain compatible with the provider-neutral
`LlmResult`.

### 5. Replace stub tests with event-focused tests

Rewrite `packages/emitter/src/session.test.ts` around a deterministic runtime:

- collect emitted events in an array through the in-memory delivery seam;
- supply ordered UUIDs and wall/monotonic readings without fake global timers;
- parse every captured value with `TraceEvent` in the test only, proving wire
  validity without adding emitter-side runtime validation;
- retain compile-time assertions for required usage and add one for required
  prompt metadata.

Cover these cases:

| Case                   | Required assertions                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Nested success path    | All five event types, exact order, one session ID, unique event/span IDs, correct root/child/call parent pointers |
| Agent success          | One start and one finish; string output captured; non-string result returned unchanged and omitted from payload   |
| Agent failure          | Exactly one error finish, safe message only, original thrown identity preserved                                   |
| Delegation             | Parent `delegated` precedes child start; task and child name captured; child result preserved                     |
| LLM text response      | Prompt, text, model/provider, tokens, completion timestamp, and monotonic duration captured                       |
| LLM tool-call response | Normalized tool calls serialized deterministically; original result object returned unchanged                     |
| LLM rejection          | Original rejection preserved; no invalid `llm_called`; enclosing agent finishes with error                        |
| Tool success           | Arguments, result, status, completion timestamp, and monotonic duration captured                                  |
| Tool failure           | Error event emitted before rethrow with safe result; original thrown identity preserved                           |
| Clock change           | Backward wall-clock jump cannot make LLM/tool duration negative                                                   |
| Telemetry failure      | Throwing delivery does not change callback success or failure; warning and silent modes behave as configured      |
| Flush seam             | `Session.flush()` waits for internal delivery flush and absorbs a delivery rejection according to `onError`       |

Avoid snapshots for event assertions. Assert the important fields directly so a
contract change produces a useful failure.

### 6. Record acceptance evidence

After the implementation and tests pass, update only the E1.1 evidence in
`documentation/requirements/FR-1-trace-capture.md`:

- check “Wrapper tests prove all five event types have correct span
  relationships”;
- leave batching and transport-failure evidence unchecked for E1.2;
- do not claim HTTP delivery in public documentation.

No fixture or contract-schema edit is expected. If implementation reveals that
one is necessary, stop and run the compatibility review required for
`packages/contract` before changing it.

## Suggested commit sequence

Keep this as one E1.1 PR, but implement it in reviewable commits:

1. Ratify and add the LLM prompt/response type seam; update demo callers so the
   workspace compiles.
2. Add the internal runtime/delivery seam and implement agent plus delegation
   lifecycle events.
3. Implement LLM/tool completion events, safe error capture, and the full
   deterministic test matrix.
4. Update FR-1 acceptance evidence after verification succeeds.

## Verification

While iterating, run the narrow checks from the repository root:

```bash
pnpm --filter @agentscope/contract build
pnpm --filter @agentscope/emitter test
pnpm --filter @agentscope/emitter typecheck
pnpm --filter @agentscope/demo-agents test
pnpm --filter @agentscope/demo-agents typecheck
```

Before handing off the PR, run the repository-required sequence:

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

## Done when

- The public wrappers still return the same values and rethrow the same values.
- Captured events validate against the shared `TraceEvent` schema.
- All five event types and their parent relationships are covered by tests.
- Agent start/finish and delegation ordering is deterministic.
- LLM/tool durations use monotonic time and completion timestamps use UTC wall
  time.
- Prompts, normalized responses, tool arguments/results, token usage, string
  agent output, and safe errors are covered without truncation.
- Delivery failures cannot fail the wrapped work.
- FR-1 marks only the E1.1 acceptance item complete.
- No batching, HTTP transport, retry, ingest, provider-adapter, or E1.4
  instrumentation work has leaked into the PR.
