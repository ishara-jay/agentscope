import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    eventId: uuid('event_id').primaryKey(),
    sessionId: uuid('session_id').notNull(),
    spanId: text('span_id').notNull(),
    parentSpanId: text('parent_span_id'),
    type: text('type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('events_session_idx').on(table.sessionId, table.timestamp)],
);
