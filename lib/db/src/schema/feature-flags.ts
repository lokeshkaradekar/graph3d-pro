import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

/**
 * Global feature toggle table. Used for:
 * - Killing a feature globally (enabled_globally = false, rollout_percentage = 0)
 * - Gradual rollout (rollout_percentage = 10 → 10% of users get it)
 * - Plan-specific overrides (enabled_for_plan_slugs = ['pro', 'enterprise'])
 *
 * A feature disabled here overrides all plan/user grants.
 */
export const featureFlagsTable = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),

    // Master switch. false = feature is globally disabled for everyone
    enabledGlobally: boolean("enabled_globally").notNull().default(false),

    // 0-100. 0 = disabled. 100 = all users. Hashed per user for consistency.
    rolloutPercentage: integer("rollout_percentage").notNull().default(0),

    // Only enable for users on these plan slugs (null/empty = all plans)
    enabledForPlanSlugs: jsonb("enabled_for_plan_slugs").$type<string[]>(),

    // Kill switch: when set, this feature is blocked regardless of other flags
    killSwitchAt: timestamp("kill_switch_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("feature_flags_name_idx").on(table.name),
    index("feature_flags_enabled_globally_idx").on(table.enabledGlobally),
  ],
);

export const selectFeatureFlagSchema = createSelectSchema(featureFlagsTable);
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
