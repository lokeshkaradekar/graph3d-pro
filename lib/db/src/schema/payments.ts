import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { subscriptionsTable } from "./subscriptions";
import { paymentStatusEnum, billingProviderEnum } from "./enums";

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    subscriptionId: uuid("subscription_id").references(
      () => subscriptionsTable.id,
    ),

    provider: billingProviderEnum("provider").notNull(),

    // Provider's unique payment/charge ID (e.g. Stripe's ch_xxx or pi_xxx)
    providerPaymentId: text("provider_payment_id").notNull(),

    // Amount in smallest currency unit (cents, paise, etc.)
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),

    status: paymentStatusEnum("status").notNull().default("pending"),

    // For partial refunds: total refunded so far
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),

    // Provider invoice ID, receipt URL, etc.
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_provider_payment_id_unique").on(
      table.providerPaymentId,
    ),
    index("payments_user_id_idx").on(table.userId),
    index("payments_subscription_id_idx").on(table.subscriptionId),
    index("payments_status_idx").on(table.status),
    index("payments_paid_at_idx").on(table.paidAt),
  ],
);

export const selectPaymentSchema = createSelectSchema(paymentsTable);
export type Payment = typeof paymentsTable.$inferSelect;
