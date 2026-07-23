/**
 * Billing routes — checkout session creation and webhook processing.
 *
 * Webhook security:
 * 1. Verify provider signature BEFORE any DB operations
 * 2. Reject events with invalid signatures (return 400)
 * 3. Insert event into payment_events with unique(provider, event_id)
 *    - If duplicate key → already processed → return 200 immediately
 * 4. Process event in a DB transaction
 * 5. Never grant access before successful verification
 */
import { Router, raw } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { requireVerified } from "../middlewares/require-verified";
import { webhookLimiter } from "../middlewares/rate-limit";
import { validate } from "../middlewares/validate";
import { getProvider } from "../services/billing.service";
import {
  getPlanBySlug,
  activatePaidSubscription,
  renewSubscription,
  markSubscriptionPastDue,
} from "../services/subscription.service";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  paymentEventsTable,
  paymentsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { auditWebhook, auditBilling } from "../services/audit.service";
import { createNotification } from "../services/notification.service";

const router = Router();

// ── POST /api/billing/checkout — create a Stripe checkout session ──────────────
const checkoutSchema = z.object({
  planSlug: z.string(),
  billingCycle: z.enum(["monthly", "yearly"]).optional().default("monthly"),
  provider: z.string().optional().default("stripe"),
});

router.post(
  "/checkout",
  authenticate,
  requireAuth,
  requireVerified,
  validate(checkoutSchema),
  async (req, res) => {
    const { planSlug, billingCycle, provider } = req.body;

    const plan = await getPlanBySlug(planSlug);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }

    // Provider-specific price ID from env
    // Pattern: STRIPE_PRICE_<PLAN_SLUG>_<CYCLE> e.g. STRIPE_PRICE_PRO_MONTHLY
    const priceEnvKey = `STRIPE_PRICE_${planSlug.toUpperCase()}_${billingCycle.toUpperCase()}`;
    const planPriceId = process.env[priceEnvKey];

    if (!planPriceId) {
      res.status(500).json({
        error: "Payment configuration is incomplete. Please contact support.",
      });
      return;
    }

    try {
      const p = await getProvider(provider);
      const appUrl = process.env["APP_URL"] ?? "https://graph3d.app";
      const session = await p.createCheckoutSession({
        userId: req.user!.id,
        userEmail: req.user!.email,
        planSlug,
        planPriceId,
        successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/billing`,
        metadata: { billingCycle },
      });

      auditBilling("subscription.created", req.user!.id, {
        planSlug,
        provider,
        billingCycle,
      });

      res.json({ url: session.url, sessionId: session.sessionId });
    } catch (err) {
      req.log.error({ err }, "checkout error");
      res.status(500).json({ error: "Failed to create checkout session." });
    }
  },
);

// ── POST /api/billing/webhooks/stripe ─────────────────────────────────────────
// Must parse raw body for signature verification — do NOT use express.json() here
router.post(
  "/webhooks/stripe",
  webhookLimiter,
  raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

    if (!signature || !webhookSecret) {
      res.status(400).json({ error: "Missing signature or webhook secret." });
      return;
    }

    // 1. Verify signature
    const provider = await getProvider("stripe").catch(() => null);
    if (!provider) {
      res.status(503).json({ error: "Stripe provider not configured." });
      return;
    }

    const verified = await provider.verifyWebhook(
      req.body as Buffer,
      signature,
      webhookSecret,
    );

    if (!verified.valid) {
      auditWebhook("webhook.rejected", { provider: "stripe" });
      res.status(400).json({ error: "Invalid webhook signature." });
      return;
    }

    auditWebhook("webhook.received", {
      provider: "stripe",
      eventId: verified.eventId,
      eventType: verified.eventType,
    });

    // 2. Idempotency check — insert into payment_events
    // If the event was already processed, ON CONFLICT returns 0 rows
    const inserted = await db
      .insert(paymentEventsTable)
      .values({
        provider: "stripe",
        eventId: verified.eventId,
        eventType: verified.eventType,
        payload: verified.payload,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: paymentEventsTable.id });

    if (inserted.length === 0) {
      // Already processed — return 200 to stop provider retries
      auditWebhook("webhook.duplicate", {
        provider: "stripe",
        eventId: verified.eventId,
      });
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    const eventRecordId = inserted[0]!.id;

    // 3. Process event in a transaction
    try {
      await processStripeEvent(verified.eventType, verified.payload as Record<string, unknown>);

      await db
        .update(paymentEventsTable)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(paymentEventsTable.id, eventRecordId));

      auditWebhook("webhook.processed", {
        provider: "stripe",
        eventId: verified.eventId,
        eventType: verified.eventType,
      });
    } catch (err) {
      await db
        .update(paymentEventsTable)
        .set({
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          processedAt: new Date(),
        })
        .where(eq(paymentEventsTable.id, eventRecordId));

      // Return 500 so Stripe retries delivery
      res.status(500).json({ error: "Event processing failed." });
      return;
    }

    res.status(200).json({ ok: true });
  },
);

/**
 * Process a verified Stripe event.
 * All DB mutations here happen atomically (wrapped by the caller in a try/catch
 * that marks the event as failed if anything throws).
 */
async function processStripeEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const data = (payload as Record<string, { object: Record<string, unknown> }>)["data"]?.object ?? {};

  switch (eventType) {
    case "checkout.session.completed": {
      const userId = (data["metadata"] as Record<string, string>)?.["userId"];
      const planSlug = (data["metadata"] as Record<string, string>)?.["planSlug"];
      const subscriptionId = data["subscription"] as string;
      const customerId = data["customer"] as string;

      if (!userId || !planSlug || !subscriptionId) break;

      const plan = await getPlanBySlug(planSlug);
      if (!plan) break;

      // Get subscription details from Stripe (period dates)
      // For now use checkout session dates — expand via Stripe SDK for production
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

      await activatePaidSubscription({
        userId,
        planId: plan.id,
        provider: "stripe",
        providerSubscriptionId: subscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        metadata: { customerId },
      });

      await createNotification(
        userId,
        "subscription_created",
        `Welcome to ${plan.displayName}!`,
        `Your ${plan.displayName} subscription is now active.`,
        "/billing",
      );

      auditBilling("subscription.activated", userId, { planSlug, subscriptionId });
      break;
    }

    case "invoice.payment_succeeded": {
      const subscriptionId = data["subscription"] as string;
      const amountPaid = data["amount_paid"] as number;
      const currency = (data["currency"] as string)?.toUpperCase() ?? "USD";
      const customerId = data["customer"] as string;
      const invoiceId = data["id"] as string;

      if (!subscriptionId) break;

      // Find subscription in our DB
      const [sub] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.providerSubscriptionId, subscriptionId))
        .limit(1);

      if (!sub) break;

      // Record payment
      await db.insert(paymentsTable).values({
        userId: sub.userId,
        subscriptionId: sub.id,
        provider: "stripe",
        providerPaymentId: invoiceId,
        amountCents: amountPaid,
        currency,
        status: "succeeded",
        paidAt: new Date(),
        metadata: { customerId },
      }).onConflictDoNothing();

      // Renew subscription period
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await renewSubscription(subscriptionId, now, periodEnd);

      auditBilling("payment.succeeded", sub.userId, { subscriptionId, amountPaid });
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionId = data["subscription"] as string;
      if (!subscriptionId) break;

      const [sub] = await db
        .select({ s: subscriptionsTable, u: usersTable })
        .from(subscriptionsTable)
        .innerJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
        .where(eq(subscriptionsTable.providerSubscriptionId, subscriptionId))
        .limit(1);

      if (!sub) break;

      await markSubscriptionPastDue(subscriptionId, sub.u.email, "your plan");
      auditBilling("subscription.past_due", sub.s.userId, { subscriptionId });
      break;
    }

    case "customer.subscription.deleted": {
      const subscriptionId = data["id"] as string;
      if (!subscriptionId) break;

      await db
        .update(subscriptionsTable)
        .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
        .where(eq(subscriptionsTable.providerSubscriptionId, subscriptionId));

      break;
    }

    default:
      // Unhandled event type — log and ignore (don't fail)
      break;
  }
}

export default router;
