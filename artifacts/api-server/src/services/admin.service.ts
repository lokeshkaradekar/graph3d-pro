import { eq, and, isNull, desc, ilike, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  subscriptionsTable,
  plansTable,
  paymentsTable,
  auditLogsTable,
  paymentEventsTable,
  planFeaturesTable,
  featureFlagsTable,
  type Plan,
} from "@workspace/db";

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isVerified: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  activePlan: string | null;
}

export async function adminListUsers(
  search?: string,
  limit = 50,
  offset = 0,
): Promise<{ users: AdminUserRow[]; total: number }> {
  const whereClause = search
    ? ilike(usersTable.emailNormalized, `%${search.toLowerCase()}%`)
    : undefined;

  const [usersQuery, countQuery] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        role: usersTable.role,
        isVerified: usersTable.isVerified,
        createdAt: usersTable.createdAt,
        deletedAt: usersTable.deletedAt,
        planSlug: plansTable.slug,
      })
      .from(usersTable)
      .leftJoin(
        subscriptionsTable,
        and(
          eq(subscriptionsTable.userId, usersTable.id),
          eq(subscriptionsTable.status, "active"),
        ),
      )
      .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(usersTable)
      .where(whereClause),
  ]);

  return {
    users: usersQuery.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
      activePlan: u.planSlug ?? null,
    })),
    total: countQuery[0]?.count ?? 0,
  };
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function adminCreatePlan(params: {
  slug: string;
  displayName: string;
  description?: string;
  priceMonthlycents: number;
  priceYearlyCents: number;
  currency?: string;
  sortOrder?: number;
}): Promise<Plan> {
  const [plan] = await db
    .insert(plansTable)
    .values({
      slug: params.slug,
      displayName: params.displayName,
      description: params.description ?? null,
      priceMonthlycents: params.priceMonthlycents,
      priceYearlyCents: params.priceYearlyCents,
      currency: params.currency ?? "USD",
      sortOrder: params.sortOrder ?? 0,
    })
    .returning();
  if (!plan) throw new Error("Failed to create plan");
  return plan;
}

export async function adminSetPlanFeatures(
  planId: string,
  features: Array<{
    featureName: string;
    limitValue?: number | null;
    limitPeriod?: string | null;
  }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Replace all plan features
    await tx
      .delete(planFeaturesTable)
      .where(eq(planFeaturesTable.planId, planId));

    if (features.length > 0) {
      await tx.insert(planFeaturesTable).values(
        features.map((f) => ({
          planId,
          featureName: f.featureName,
          limitValue: f.limitValue ?? null,
          limitPeriod: f.limitPeriod ?? null,
        })),
      );
    }
  });
}

// ── Feature flags ─────────────────────────────────────────────────────────────

export async function adminSetFeatureFlag(
  name: string,
  options: {
    enabledGlobally?: boolean;
    rolloutPercentage?: number;
    description?: string;
  },
): Promise<void> {
  await db
    .insert(featureFlagsTable)
    .values({
      name,
      description: options.description ?? null,
      enabledGlobally: options.enabledGlobally ?? false,
      rolloutPercentage: options.rolloutPercentage ?? 0,
    })
    .onConflictDoUpdate({
      target: featureFlagsTable.name,
      set: {
        enabledGlobally: options.enabledGlobally ?? false,
        rolloutPercentage: options.rolloutPercentage ?? 0,
        description: options.description ?? null,
        updatedAt: new Date(),
      },
    });
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function adminGetDashboardStats(): Promise<{
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  totalRevenueCents: number;
  recentPayments: number;
}> {
  const [userStats, subStats, paymentStats] = await Promise.all([
    db.execute<{ total: string; verified: string }>(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_verified = true) AS verified
      FROM users WHERE deleted_at IS NULL
    `),
    db.execute<{ active: string }>(sql`
      SELECT COUNT(*) AS active
      FROM subscriptions
      WHERE status IN ('active', 'trialing')
    `),
    db.execute<{ total_cents: string; recent: string }>(sql`
      SELECT
        COALESCE(SUM(amount_cents), 0) AS total_cents,
        COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS recent
      FROM payments WHERE status = 'succeeded'
    `),
  ]);

  return {
    totalUsers: Number(userStats.rows[0]?.total ?? 0),
    verifiedUsers: Number(userStats.rows[0]?.verified ?? 0),
    activeSubscriptions: Number(subStats.rows[0]?.active ?? 0),
    totalRevenueCents: Number(paymentStats.rows[0]?.total_cents ?? 0),
    recentPayments: Number(paymentStats.rows[0]?.recent ?? 0),
  };
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export async function adminGetAuditLogs(
  options: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const conditions = [];
  if (options.actorId) conditions.push(eq(auditLogsTable.actorId, options.actorId));
  if (options.action) conditions.push(eq(auditLogsTable.action, options.action));
  if (options.resourceType) conditions.push(eq(auditLogsTable.resourceType, options.resourceType));

  return db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);
}

// ── Webhook history ───────────────────────────────────────────────────────────

export async function adminGetWebhookEvents(limit = 50) {
  return db
    .select()
    .from(paymentEventsTable)
    .orderBy(desc(paymentEventsTable.createdAt))
    .limit(limit);
}
