import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { featureGrantSourceEnum } from "./enums";

/**
 * Per-user feature grants that override or supplement the subscription plan.
 * Used by admins to grant special access, apply coupons, referral bonuses, etc.
 *
 * The effective feature set for a user is:
 *   UNION(plan features from active subscription, rows in this table where not revoked/expired)
 */
export const userFeaturesTable = pgTable(
  "user_features",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    featureName: text("feature_name").notNull(),

    grantedBy: featureGrantSourceEnum("granted_by").notNull().default("admin"),

    // ID of the admin user or coupon/referral code that granted this
    grantedByRef: text("granted_by_ref"),

    // null = unlimited (same as plan feature limit_value semantics)
    limitValue: integer("limit_value"),

    // null = permanent grant
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Set when admin revokes the grant
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One active grant per user per feature (allow multiple for history; use latest)
    unique("user_features_user_feature_unique").on(
      table.userId,
      table.featureName,
    ),
    index("user_features_user_id_idx").on(table.userId),
    index("user_features_feature_name_idx").on(table.featureName),
  ],
);

export type UserFeature = typeof userFeaturesTable.$inferSelect;
