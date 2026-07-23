/**
 * Feature Service — the core of the subscription access control system.
 *
 * RULE: Never check plan names (user.plan === 'pro').
 * ALWAYS check: await featureService.hasFeature(userId, FEATURES.AI_ASSISTANT)
 *
 * Effective feature set for a user is the UNION of:
 *   1. Features included in their active subscription plan (plan_features)
 *   2. Features individually granted to them (user_features)
 *
 * Filtered by:
 *   - Global feature flags (kill-switch can disable regardless)
 *   - Subscription status (must be active/trialing/grace_period)
 *   - Individual feature expiry and revocation
 */
import { eq, and, isNull, or, gt, isNotNull, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  subscriptionsTable,
  plansTable,
  planFeaturesTable,
  userFeaturesTable,
  featureFlagsTable,
  usageTable,
  type PlanFeature,
  type UserFeature,
} from "@workspace/db";
import { FREE_PLAN_SLUG } from "../lib/constants";
import { currentMonthPeriod, currentYearPeriod } from "../lib/crypto";

export interface EffectiveFeature {
  featureName: string;
  source: "plan" | "grant";
  limitValue: number | null; // null = unlimited
  limitPeriod: string | null;
}

export interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number | null; // null = unlimited, undefined = not applicable
}

/**
 * Get the effective plan for a user.
 * If they have no active subscription, they're on the free plan.
 */
async function getEffectivePlanId(userId: string): Promise<string | null> {
  const now = new Date();

  // Active/trialing/grace_period subscription
  const [sub] = await db
    .select({ planId: subscriptionsTable.planId, status: subscriptionsTable.status, gracePeriodEndsAt: subscriptionsTable.gracePeriodEndsAt, currentPeriodEnd: subscriptionsTable.currentPeriodEnd, trialEndsAt: subscriptionsTable.trialEndsAt })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        or(
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.status, "trialing"),
          eq(subscriptionsTable.status, "grace_period"),
        ),
      ),
    )
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!sub) {
    // No subscription — resolve free plan
    const [freePlan] = await db
      .select({ id: plansTable.id })
      .from(plansTable)
      .where(eq(plansTable.slug, FREE_PLAN_SLUG))
      .limit(1);
    return freePlan?.id ?? null;
  }

  // Check if subscription is still within valid period
  if (sub.status === "active") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
      // Period has ended — check if grace period applies
      return null; // will fall back to free
    }
  } else if (sub.status === "trialing") {
    if (sub.trialEndsAt && sub.trialEndsAt < now) return null;
  } else if (sub.status === "grace_period") {
    if (sub.gracePeriodEndsAt && sub.gracePeriodEndsAt < now) return null;
  }

  return sub.planId;
}

/** Get all effective features for a user */
export async function getUserFeatures(
  userId: string,
): Promise<EffectiveFeature[]> {
  const now = new Date();

  // 1. Plan features
  const planId = await getEffectivePlanId(userId);
  const planFeatures: EffectiveFeature[] = planId
    ? (
        await db
          .select()
          .from(planFeaturesTable)
          .where(eq(planFeaturesTable.planId, planId))
      )
        .filter((pf) => pf.limitValue !== 0) // 0 = explicitly disabled
        .map((pf) => ({
          featureName: pf.featureName,
          source: "plan" as const,
          limitValue: pf.limitValue,
          limitPeriod: pf.limitPeriod,
        }))
    : [];

  // 2. Individual grants (not revoked, not expired)
  const userGrants = await db
    .select()
    .from(userFeaturesTable)
    .where(
      and(
        eq(userFeaturesTable.userId, userId),
        isNull(userFeaturesTable.revokedAt),
        or(isNull(userFeaturesTable.expiresAt), gt(userFeaturesTable.expiresAt, now)),
      ),
    );

  const grantedFeatures: EffectiveFeature[] = userGrants.map((ug) => ({
    featureName: ug.featureName,
    source: "grant" as const,
    limitValue: ug.limitValue,
    limitPeriod: null,
  }));

  // Merge: grants override plan features for the same feature name
  const featureMap = new Map<string, EffectiveFeature>();
  for (const pf of planFeatures) featureMap.set(pf.featureName, pf);
  for (const gf of grantedFeatures) featureMap.set(gf.featureName, gf); // grants win

  return Array.from(featureMap.values());
}

/**
 * Primary access check.
 * This is the function that every protected endpoint calls.
 * Never bypass this with plan-name checks.
 */
export async function hasFeature(
  userId: string,
  featureName: string,
): Promise<FeatureCheckResult> {
  // 1. Check global feature flag (kill-switch)
  const [flag] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.name, featureName))
    .limit(1);

  if (flag) {
    // Kill switch active
    if (flag.killSwitchAt && flag.killSwitchAt <= new Date()) {
      return { allowed: false, reason: "Feature is temporarily disabled." };
    }
    // Globally disabled with no rollout
    if (!flag.enabledGlobally && flag.rolloutPercentage === 0) {
      return { allowed: false, reason: "Feature is not available." };
    }
  }

  // 2. Check plan + individual grants
  const features = await getUserFeatures(userId);
  const match = features.find((f) => f.featureName === featureName);

  if (!match) {
    return { allowed: false, reason: "Your plan does not include this feature." };
  }

  // 3. Check quota (if limit exists)
  if (match.limitValue !== null && match.limitValue > 0) {
    const period = match.limitPeriod === "yearly"
      ? currentYearPeriod()
      : match.limitPeriod === "monthly"
        ? currentMonthPeriod()
        : "all-time";

    const [usageRow] = await db
      .select()
      .from(usageTable)
      .where(
        and(
          eq(usageTable.userId, userId),
          eq(
            usageTable.metric,
            featureName as typeof usageTable.$inferSelect["metric"],
          ),
          eq(usageTable.period, period),
        ),
      )
      .limit(1);

    const used = Number(usageRow?.value ?? 0);
    const remaining = match.limitValue - used;

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `You've reached your ${match.limitPeriod ?? ""} limit for this feature.`,
        remaining: 0,
      };
    }

    return { allowed: true, remaining };
  }

  // Unlimited access
  return { allowed: true, remaining: null };
}

/** Grant a feature to a user (admin or system action) */
export async function grantFeature(
  userId: string,
  featureName: string,
  options: {
    grantedBy?: "admin" | "plan_bonus" | "coupon" | "referral" | "promotion";
    grantedByRef?: string;
    limitValue?: number | null;
    expiresAt?: Date | null;
  } = {},
): Promise<void> {
  await db
    .insert(userFeaturesTable)
    .values({
      userId,
      featureName,
      grantedBy: options.grantedBy ?? "admin",
      grantedByRef: options.grantedByRef ?? null,
      limitValue: options.limitValue ?? null,
      expiresAt: options.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: [userFeaturesTable.userId, userFeaturesTable.featureName],
      set: {
        grantedBy: options.grantedBy ?? "admin",
        grantedByRef: options.grantedByRef ?? null,
        limitValue: options.limitValue ?? null,
        expiresAt: options.expiresAt ?? null,
        revokedAt: null,
      },
    });
}

/** Revoke a feature from a user */
export async function revokeFeature(
  userId: string,
  featureName: string,
): Promise<void> {
  await db
    .update(userFeaturesTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userFeaturesTable.userId, userId),
        eq(userFeaturesTable.featureName, featureName),
        isNull(userFeaturesTable.revokedAt),
      ),
    );
}
