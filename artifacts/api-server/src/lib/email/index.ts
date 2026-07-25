/**
 * Email service, provider-agnostic.
 *
 * In development (NODE_ENV !== "production"): logs instead of sending.
 * In production: sends via Resend. To switch providers later, add a class
 * implementing `EmailProvider` in ./provider.ts and change `getProvider()`
 * below — the four functions exported here, and everywhere that calls
 * them, never change.
 */
import { logger } from "../logger";
import { ConsoleEmailProvider, ResendEmailProvider, type EmailProvider } from "./provider";
import {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  paymentFailedEmailTemplate,
  subscriptionCanceledEmailTemplate,
} from "./templates";
import { APP_URL } from "./brand";

const isDev = process.env["NODE_ENV"] !== "production";
const resendApiKey = process.env["RESEND_API_KEY"];

function getProvider(): EmailProvider {
  if (isDev) return new ConsoleEmailProvider();
  if (!resendApiKey) {
    logger.warn(
      "RESEND_API_KEY is not set in production — falling back to the console provider. Emails will NOT be delivered.",
    );
    return new ConsoleEmailProvider();
  }
  return new ResendEmailProvider(resendApiKey);
}

const provider = getProvider();

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${token}`;
  const { subject, html, text } = verificationEmailTemplate(url);
  await provider.send({ to: email, subject, html, text, idempotencyKey: `verify-email/${token}` });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${token}`;
  const { subject, html, text } = passwordResetEmailTemplate(url);
  await provider.send({ to: email, subject, html, text, idempotencyKey: `password-reset/${token}` });
}

export async function sendPaymentFailedEmail(
  email: string,
  planName: string,
  gracePeriodEndsAt: Date,
): Promise<void> {
  const graceDate = gracePeriodEndsAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const { subject, html, text } = paymentFailedEmailTemplate(planName, graceDate, `${APP_URL}/billing`);
  await provider.send({
    to: email,
    subject,
    html,
    text,
    idempotencyKey: `payment-failed/${email}/${gracePeriodEndsAt.toISOString()}`,
  });
}

export async function sendSubscriptionCanceledEmail(
  email: string,
  planName: string,
  accessEndsAt: Date,
): Promise<void> {
  const endDate = accessEndsAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const { subject, html, text } = subscriptionCanceledEmailTemplate(planName, endDate, `${APP_URL}/billing`);
  await provider.send({
    to: email,
    subject,
    html,
    text,
    idempotencyKey: `subscription-canceled/${email}/${accessEndsAt.toISOString()}`,
  });
}
