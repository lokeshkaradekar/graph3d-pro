/**
 * Provider-agnostic billing layer.
 *
 * All payment provider interactions go through this interface.
 * To add a new provider (Razorpay, Paddle, etc.):
 *   1. Create providers/<name>.provider.ts implementing BillingProvider
 *   2. Register it in getProvider() below
 *   3. No changes to route handlers or webhook logic needed
 */
import { logger } from "../lib/logger";

// ── Provider interface ────────────────────────────────────────────────────────

export interface CheckoutSessionParams {
  userId: string;
  userEmail: string;
  planSlug: string;
  planPriceId: string; // Provider-specific price ID
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string; // Redirect user here to complete payment
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult>;
  verifyWebhook(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): Promise<WebhookVerificationResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  createRefund(
    providerPaymentId: string,
    amountCents?: number,
  ): Promise<{ refundId: string }>;
}

// ── Provider registry ─────────────────────────────────────────────────────────

let providerCache: Map<string, BillingProvider> | null = null;

async function buildProviders(): Promise<Map<string, BillingProvider>> {
  if (providerCache) return providerCache;
  providerCache = new Map();

  if (process.env["STRIPE_SECRET_KEY"]) {
    const { StripeProvider } = await import("./providers/stripe.provider");
    providerCache.set("stripe", new StripeProvider());
    logger.info("Billing: Stripe provider registered");
  } else {
    logger.warn(
      "Billing: STRIPE_SECRET_KEY not set — Stripe provider unavailable",
    );
  }

  return providerCache;
}

export async function getProvider(name: string): Promise<BillingProvider> {
  const providers = await buildProviders();
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Billing provider '${name}' is not configured`);
  }
  return provider;
}

export async function getAvailableProviders(): Promise<string[]> {
  const providers = await buildProviders();
  return Array.from(providers.keys());
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  provider: string,
  params: CheckoutSessionParams,
): Promise<CheckoutSessionResult> {
  const p = await getProvider(provider);
  return p.createCheckoutSession(params);
}

// ── Refunds ───────────────────────────────────────────────────────────────────

export async function issueRefund(
  provider: string,
  providerPaymentId: string,
  amountCents?: number,
): Promise<{ refundId: string }> {
  const p = await getProvider(provider);
  return p.createRefund(providerPaymentId, amountCents);
}
