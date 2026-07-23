import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { auditActorTypeEnum } from "./enums";

/**
 * Immutable audit trail. Never update or delete rows here.
 *
 * action format: '<service>.<event>'
 * Examples:
 *   auth.login_success       auth.login_failed      auth.logout
 *   auth.password_changed    auth.email_verified
 *   subscription.created     subscription.canceled  subscription.renewed
 *   payment.succeeded        payment.failed         payment.refunded
 *   feature.granted          feature.revoked
 *   graph.created            graph.deleted          graph.shared
 *   admin.user_banned        admin.plan_changed
 *   webhook.received         webhook.processed      webhook.rejected
 */
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Who performed the action. Null for system/webhook actors.
    actorId: text("actor_id"),
    actorType: auditActorTypeEnum("actor_type").notNull().default("user"),

    // The action that occurred
    action: text("action").notNull(),

    // What was affected
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),

    // Contextual data (plan names, feature names, amounts, etc.)
    // Redact sensitive fields before storing (no passwords, tokens, PII beyond IDs)
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Immutable — no updatedAt
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
