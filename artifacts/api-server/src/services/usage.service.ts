import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usageTable } from "@workspace/db";
import { currentMonthPeriod, currentYearPeriod } from "../lib/crypto";
import type { usageMetricEnum } from "@workspace/db";
import type { InferSelectModel } from "drizzle-orm";

type UsageMetric = InferSelectModel<typeof usageTable>["metric"];

/**
 * Increment a usage counter for a user.
 * Uses an upsert to atomically increment — safe for concurrent requests.
 */
export async function incrementUsage(
  userId: string,
  metric: UsageMetric,
  amount = 1,
  period?: string,
): Promise<void> {
  const resolvedPeriod = period ?? currentMonthPeriod();

  await db.execute(sql`
    INSERT INTO usage (id, user_id, metric, period, value, last_updated_at, created_at)
    VALUES (
      gen_random_uuid(),
      ${userId},
      ${metric},
      ${resolvedPeriod},
      ${amount},
      now(),
      now()
    )
    ON CONFLICT (user_id, metric, period)
    DO UPDATE SET
      value = usage.value + EXCLUDED.value,
      last_updated_at = now()
  `);

  // Also increment the all-time counter
  if (resolvedPeriod !== "all-time") {
    await db.execute(sql`
      INSERT INTO usage (id, user_id, metric, period, value, last_updated_at, created_at)
      VALUES (
        gen_random_uuid(),
        ${userId},
        ${metric},
        'all-time',
        ${amount},
        now(),
        now()
      )
      ON CONFLICT (user_id, metric, period)
      DO UPDATE SET
        value = usage.value + EXCLUDED.value,
        last_updated_at = now()
    `);
  }
}

/** Get all usage stats for a user for the current month */
export async function getUserUsage(userId: string): Promise<
  Array<{
    metric: UsageMetric;
    period: string;
    value: number;
  }>
> {
  const monthPeriod = currentMonthPeriod();
  const yearPeriod = currentYearPeriod();

  const rows = await db.execute<{
    metric: UsageMetric;
    period: string;
    value: string;
  }>(sql`
    SELECT metric, period, value
    FROM usage
    WHERE user_id = ${userId}
      AND period IN (${monthPeriod}, ${yearPeriod}, 'all-time')
    ORDER BY metric, period
  `);

  return rows.rows.map((r) => ({
    metric: r.metric,
    period: r.period,
    value: Number(r.value),
  }));
}

/** Get a specific usage value */
export async function getUsageValue(
  userId: string,
  metric: UsageMetric,
  period: string,
): Promise<number> {
  const result = await db.execute<{ value: string }>(sql`
    SELECT value FROM usage
    WHERE user_id = ${userId} AND metric = ${metric} AND period = ${period}
    LIMIT 1
  `);
  return Number(result.rows[0]?.value ?? 0);
}
