import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { plansTable } from "./plans";

/**
 * Defines which features are included in each plan and their limits.
 *
 * limit_value semantics:
 *   null  → unlimited (feature is fully enabled, no quota)
 *   0     → disabled (feature exists but is off for this plan)
 *   N > 0 → quota (user can use this feature up to N times per limit_period)
 *
 * limit_period: 'monthly' | 'yearly' | 'lifetime' | null (for unlimited)
 *
 * Examples:
 *   (pro, 'ai_assistant', null, null)     → unlimited AI for pro users
 *   (free, 'ai_assistant', 10, 'monthly') → 10 AI requests/month on free
 *   (free, 'gpu_rendering', 0, null)      → GPU rendering disabled on free
 *   (pro, 'api_access', null, null)       → unlimited API access on pro
 */
export const planFeaturesTable = pgTable(
  "plan_features",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plansTable.id, { onDelete: "cascade" }),

    // Feature identifier — matches keys in FEATURE_NAMES constant
    featureName: text("feature_name").notNull(),

    // null = unlimited, 0 = disabled, N = quota
    // bigint because storage limits can exceed int32 (e.g. 5 GB = 5_368_709_120)
    limitValue: bigint("limit_value", { mode: "number" }),

    // 'monthly' | 'yearly' | 'lifetime' | null
    limitPeriod: text("limit_period"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("plan_features_plan_feature_unique").on(
      table.planId,
      table.featureName,
    ),
    index("plan_features_plan_id_idx").on(table.planId),
    index("plan_features_feature_name_idx").on(table.featureName),
  ],
);

export type PlanFeature = typeof planFeaturesTable.$inferSelect;
