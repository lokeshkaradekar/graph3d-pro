import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { plansTable } from "./plans";
import { subscriptionStatusEnum, billingProviderEnum } from "./enums";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plansTable.id),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    provider: billingProviderEnum("provider"),
    providerSubscriptionId: text("provider_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_user_id_status_idx").on(table.userId, table.status),
    index("subscriptions_provider_sub_id_idx").on(table.providerSubscriptionId),
    index("subscriptions_plan_id_idx").on(table.planId),
    index("subscriptions_status_idx").on(table.status),
    uniqueIndex("subscriptions_provider_sub_id_unique").on(table.providerSubscriptionId),
    // At most one "currently in effect" subscription per user. This is
    // the actual airtight fix for a race that wrapping
    // activatePaidSubscription's cancel+insert in a transaction alone
    // can't fully close (Postgres's default READ COMMITTED isolation
    // lets two concurrent transactions each see zero existing active
    // rows before either commits, so both could insert one). With this
    // constraint, the second concurrent insert is rejected outright by
    // the database instead of silently creating a duplicate — the
    // webhook handler already treats a thrown error as "mark this event
    // failed, let the provider retry delivery."
    uniqueIndex("subscriptions_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.status} IN ('active', 'trialing', 'grace_period')`),
  ],
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
