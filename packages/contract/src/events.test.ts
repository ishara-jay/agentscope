import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IngestBatch, TraceEvent } from './events.js';

const fixture = JSON.parse(readFileSync(new URL('../fixture.json', import.meta.url), 'utf8')) as {
  events: unknown[];
};

const events = fixture.events.map((e) => TraceEvent.parse(e));

describe('fixture.json obeys the contract (DD-5 CI check)', () => {
  it('every event parses as a TraceEvent', () => {
    for (const [i, raw] of fixture.events.entries()) {
      const result = TraceEvent.safeParse(raw);
      expect(result.success, `event #${i} failed: ${JSON.stringify(raw).slice(0, 120)}`).toBe(true);
    }
  });

  it('the whole array is a valid IngestBatch', () => {
    expect(IngestBatch.safeParse({ events: fixture.events }).success).toBe(true);
  });

  it('all events belong to one session', () => {
    expect(new Set(events.map((e) => e.session_id)).size).toBe(1);
  });

  it('timestamps are non-decreasing', () => {
    const times = events.map((e) => Date.parse(e.timestamp));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
    }
  });
});

describe('span rules (design 02 §2 — enforceable only across events)', () => {
  const agentSpanIds = new Set(
    events.filter((e) => e.type === 'agent_started').map((e) => e.span_id),
  );

  it('exactly one agent_started per agent span', () => {
    const counts = new Map<string, number>();
    for (const e of events.filter((e) => e.type === 'agent_started')) {
      counts.set(e.span_id, (counts.get(e.span_id) ?? 0) + 1);
    }
    for (const [span, n] of counts) {
      expect(n, `span ${span} has ${n} agent_started events`).toBe(1);
    }
  });

  it('at most one agent_finished per span, and only on started spans', () => {
    const finished = events.filter((e) => e.type === 'agent_finished');
    const seen = new Set<string>();
    for (const e of finished) {
      expect(agentSpanIds.has(e.span_id), `finished span ${e.span_id} never started`).toBe(true);
      expect(seen.has(e.span_id), `span ${e.span_id} finished twice`).toBe(false);
      seen.add(e.span_id);
    }
  });

  it('llm_called and tool_called spans have an agent span as parent', () => {
    for (const e of events.filter((e) => e.type === 'llm_called' || e.type === 'tool_called')) {
      expect(
        e.parent_span_id !== null && agentSpanIds.has(e.parent_span_id),
        `${e.type} span ${e.span_id} has non-agent parent ${e.parent_span_id}`,
      ).toBe(true);
    }
  });

  it('the root span is an agent span with a null parent', () => {
    const roots = new Set(events.filter((e) => e.parent_span_id === null).map((e) => e.span_id));
    expect(roots.size).toBe(1);
    const [root] = roots;
    expect(agentSpanIds.has(root!)).toBe(true);
  });

  it('delegated events are emitted on the delegating (agent) span', () => {
    for (const e of events.filter((e) => e.type === 'delegated')) {
      expect(agentSpanIds.has(e.span_id), `delegated on non-agent span ${e.span_id}`).toBe(true);
    }
  });
});

describe('invalid events are rejected (the fence actually holds)', () => {
  const valid = fixture.events[0] as Record<string, unknown>;

  it('unknown type fails', () => {
    expect(TraceEvent.safeParse({ ...valid, type: 'bogus' }).success).toBe(false);
  });

  it('missing session_id fails', () => {
    const rest = { ...valid };
    delete rest.session_id;
    expect(TraceEvent.safeParse(rest).success).toBe(false);
  });

  it('non-uuid event_id fails', () => {
    expect(TraceEvent.safeParse({ ...valid, event_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('negative token counts fail', () => {
    const llm = fixture.events[1] as { payload: Record<string, unknown> };
    const broken = { ...llm, payload: { ...llm.payload, input_tokens: -5 } };
    expect(TraceEvent.safeParse(broken).success).toBe(false);
  });

  it('empty batch fails, and so does one over 100 events', () => {
    expect(IngestBatch.safeParse({ events: [] }).success).toBe(false);
    const many = Array.from({ length: 101 }, () => fixture.events[0]);
    expect(IngestBatch.safeParse({ events: many }).success).toBe(false);
  });
});
