/**
 * Stripe billing provider implementation.
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY      — sk_live_xxx or sk_test_xxx
 *   STRIPE_WEBHOOK_SECRET  — whsec_xxx (from Stripe webhook settings)
 */
import Stripe from "stripe";
import type {
  BillingProvider,
  CheckoutSessionParams,
  CheckoutSessionResult,
  WebhookVerificationResult,
} from "../billing.service";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

export class StripeProvider implements BillingProvider {
  readonly name = "stripe";

  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const stripe = getStripe();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: params.userEmail,
      line_items: [
        {
          price: params.planPriceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        planSlug: params.planSlug,
        ...params.metadata,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          planSlug: params.planSlug,
        },
        ...(params.trialDays
          ? { trial_period_days: params.trialDays }
          : {}),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Verify Stripe webhook signature.
   * This MUST be called before processing ANY webhook payload.
   * Never process a webhook without verified signature.
   */
  async verifyWebhook(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): Promise<WebhookVerificationResult> {
    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      return {
        valid: false,
        eventId: "",
        eventType: "",
        payload: {},
      };
    }

    return {
      valid: true,
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(providerSubscriptionId);
  }

  async createRefund(
    providerPaymentId: string,
    amountCents?: number,
  ): Promise<{ refundId: string }> {
    const stripe = getStripe();

    const params: Stripe.RefundCreateParams = {
      payment_intent: providerPaymentId,
      ...(amountCents ? { amount: amountCents } : {}),
    };

    const refund = await stripe.refunds.create(params);
    return { refundId: refund.id };
  }
}
