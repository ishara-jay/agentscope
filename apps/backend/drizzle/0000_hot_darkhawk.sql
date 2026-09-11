CREATE TABLE "events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_session_idx" ON "events" USING btree ("session_id","timestamp");