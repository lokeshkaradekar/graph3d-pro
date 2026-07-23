import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { usageMetricEnum } from "./enums";

/**
 * Per-user usage counters for quota enforcement.
 *
 * period format:
 *   'all-time'  → lifetime total
 *   '2026-07'   → monthly (YYYY-MM)
 *   '2026'      → yearly  (YYYY)
 *
 * Increment with:
 *   INSERT INTO usage (user_id, metric, period, value)
 *   VALUES ($userId, $metric, $period, $amount)
 *   ON CONFLICT (user_id, metric, period)
 *   DO UPDATE SET value = usage.value + EXCLUDED.value, last_updated_at = now()
 */
export const usageTable = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    metric: usageMetricEnum("metric").notNull(),

    // Period identifier: 'all-time', '2026-07', '2026'
    period: text("period").notNull(),

    // Use bigint for storage_bytes and compute_seconds
    value: bigint("value", { mode: "number" }).notNull().default(0),

    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("usage_user_metric_period_unique").on(
      table.userId,
      table.metric,
      table.period,
    ),
    index("usage_user_id_idx").on(table.userId),
    index("usage_metric_period_idx").on(table.metric, table.period),
  ],
);

export type Usage = typeof usageTable.$inferSelect;
