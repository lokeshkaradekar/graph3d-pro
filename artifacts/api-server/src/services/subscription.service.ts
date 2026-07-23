import { eq, and, or, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  subscriptionsTable,
  plansTable,
  notificationsTable,
  type Subscription,
  type Plan,
} from "@workspace/db";
import { GRACE_PERIOD_DAYS, FREE_PLAN_SLUG } from "../lib/constants";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
} from "../lib/email";

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: Plan;
}

/** Get the currently active subscription for a user (including trialing/grace) */
export async function getActiveSubscription(
  userId: string,
): Promise<SubscriptionWithPlan | null> {
  const rows = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
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

  return rows[0] ?? null;
}

/** Get subscription history for a user */
export async function getSubscriptionHistory(
  userId: string,
): Promise<SubscriptionWithPlan[]> {
  return db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt));
}

/** Get all public plans */
export async function getPublicPlans(): Promise<Plan[]> {
  return db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.isActive, true), eq(plansTable.isPublic, true)))
    .orderBy(plansTable.sortOrder);
}

/** Get plan by slug */
export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.slug, slug), eq(plansTable.isActive, true)))
    .limit(1);
  return plan ?? null;
}

/** Create a free subscription for a new user */
export async function createFreeSubscription(userId: string): Promise<Subscription> {
  const freePlan = await getPlanBySlug(FREE_PLAN_SLUG);
  if (!freePlan) throw new Error("Free plan not found — run seed data");

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      planId: freePlan.id,
      status: "active",
      provider: null,
    })
    .returning();

  if (!sub) throw new Error("Failed to create free subscription");
  return sub;
}

/**
 * Activate a paid subscription after successful payment.
 * Called by the webhook processor.
 */
export async function activatePaidSubscription(params: {
  userId: string;
  planId: string;
  provider: "stripe" | "razorpay" | "paddle";
  providerSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<Subscription> {
  // Cancel any existing active subscription and insert the new one
  // atomically — done as two separate statements before, which left a
  // real race window: two near-simultaneous webhook deliveries for the
  // same user (e.g. a fast cancel-then-resubscribe) could each see "no
  // active row yet" and each insert their own active row, leaving two
  // active subscriptions for one user.
  const sub = await db.transaction(async (tx) => {
    await tx
      .update(subscriptionsTable)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionsTable.userId, params.userId),
          or(
            eq(subscriptionsTable.status, "active"),
            eq(subscriptionsTable.status, "trialing"),
            eq(subscriptionsTable.status, "grace_period"),
          ),
        ),
      );

    const [inserted] = await tx
      .insert(subscriptionsTable)
      .values({
        userId: params.userId,
        planId: params.planId,
        status: params.trialEndsAt ? "trialing" : "active",
        provider: params.provider,
        providerSubscriptionId: params.providerSubscriptionId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        trialEndsAt: params.trialEndsAt ?? null,
        metadata: params.metadata,
      })
      .returning();

    return inserted;
  });

  if (!sub) throw new Error("Failed to activate subscription");
  return sub;
}

/**
 * Handle subscription renewal (payment succeeded for renewal).
 */
export async function renewSubscription(
  providerSubscriptionId: string,
  newPeriodStart: Date,
  newPeriodEnd: Date,
): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({
      status: "active",
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.providerSubscriptionId, providerSubscriptionId));
}

/**
 * Mark subscription as past_due and start grace period.
 * Called when a payment fails.
 */
export async function markSubscriptionPastDue(
  providerSubscriptionId: string,
  userEmail: string,
  planName: string,
): Promise<void> {
  const gracePeriodEndsAt = new Date(
    Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  await db
    .update(subscriptionsTable)
    .set({
      status: "grace_period",
      gracePeriodEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.providerSubscriptionId, providerSubscriptionId));

  await sendPaymentFailedEmail(userEmail, planName, gracePeriodEndsAt);
}

/**
 * Cancel a subscription.
 * If atPeriodEnd=true, access continues until currentPeriodEnd.
 * If atPeriodEnd=false (immediate), access is revoked now.
 */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  atPeriodEnd: boolean,
): Promise<void> {
  const [sub] = await db
    .select({ subscription: subscriptionsTable, plan: plansTable })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(
      and(
        eq(subscriptionsTable.id, subscriptionId),
        eq(subscriptionsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!sub) return;

  if (atPeriodEnd) {
    await db
      .update(subscriptionsTable)
      .set({
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subscriptionId));

    const accessEndsAt =
      sub.subscription.currentPeriodEnd ?? new Date();
    await sendSubscriptionCanceledEmail(
      sub.subscription.userId, // We'd need user email here — pass it in
      sub.plan.displayName,
      accessEndsAt,
    );
  } else {
    await db
      .update(subscriptionsTable)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subscriptionId));
  }
}

/** Expire all subscriptions whose grace period has ended */
export async function expireOverdueSubscriptions(): Promise<void> {
  const now = new Date();
  await db
    .update(subscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(subscriptionsTable.status, "grace_period"),
        sql`${subscriptionsTable.gracePeriodEndsAt} < ${now.toISOString()}`,
      ),
    );
}
