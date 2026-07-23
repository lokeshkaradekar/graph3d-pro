import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { paymentEventStatusEnum, billingProviderEnum } from "./enums";

/**
 * Idempotency table for webhook event processing.
 *
 * Before processing any webhook:
 *   1. INSERT INTO payment_events (provider, event_id, ...) ON CONFLICT DO NOTHING
 *   2. If 0 rows inserted → already processed → return 200 immediately
 *   3. If 1 row inserted → new event → process in a transaction, then mark processed
 *
 * The unique constraint on (provider, event_id) is the idempotency key.
 * This guarantees exactly-once processing even when the provider retries delivery.
 */
export const paymentEventsTable = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

    provider: billingProviderEnum("provider").notNull(),

    // Provider's event ID (e.g. Stripe's evt_xxx). This is the idempotency key.
    eventId: text("event_id").notNull(),

    eventType: text("event_type").notNull(),

    // Full raw payload from provider (for replay/debugging)
    payload: jsonb("payload").$type<Record<string, unknown>>(),

    status: paymentEventStatusEnum("status").notNull().default("pending"),

    // Error message if processing failed
    error: text("error"),

    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // This is the idempotency constraint
    unique("payment_events_provider_event_id_unique").on(
      table.provider,
      table.eventId,
    ),
    index("payment_events_status_idx").on(table.status),
    index("payment_events_event_type_idx").on(table.eventType),
    index("payment_events_created_at_idx").on(table.createdAt),
  ],
);

export type PaymentEvent = typeof paymentEventsTable.$inferSelect;
