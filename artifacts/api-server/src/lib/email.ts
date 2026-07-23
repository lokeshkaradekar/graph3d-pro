/**
 * Email service — production-ready stub with nodemailer
 *
 * In development (NODE_ENV !== 'production'):
 *   Logs emails to console instead of sending
 *
 * In production:
 *   Reads SMTP_* env vars and sends via nodemailer
 *   Swap this out for SendGrid/Resend/SES by changing the transport
 */
import { logger } from "./logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const isDev = process.env["NODE_ENV"] !== "production";
const APP_NAME = "Graph3D";
const APP_URL = process.env["APP_URL"] ?? "https://graph3d.app";
const FROM_EMAIL =
  process.env["SMTP_FROM"] ?? `noreply@graph3d.app`;

async function sendEmail(options: EmailOptions): Promise<void> {
  if (isDev) {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        preview: options.text?.slice(0, 200),
      },
      "[DEV] Email suppressed — would send",
    );
    return;
  }

  // Production: use nodemailer with SMTP config
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env["SMTP_HOST"],
    port: Number(process.env["SMTP_PORT"] ?? 587),
    secure: process.env["SMTP_SECURE"] === "true",
    auth: {
      user: process.env["SMTP_USER"],
      pass: process.env["SMTP_PASS"],
    },
  });

  await transporter.sendMail({
    from: `"${APP_NAME}" <${FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: `Verify your ${APP_NAME} email`,
    text: `Verify your email: ${url}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your ${APP_NAME} account.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Verify Email</a>
        <p style="color:#6b7280;font-size:14px;margin-top:24px">Or copy this link: ${url}</p>
        <p style="color:#6b7280;font-size:14px">This link expires in 24 hours.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    text: `Reset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Reset your password</h2>
        <p>We received a request to reset your ${APP_NAME} password.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a>
        <p style="color:#6b7280;font-size:14px;margin-top:24px">Or copy this link: ${url}</p>
        <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
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
  await sendEmail({
    to: email,
    subject: `Action required: ${APP_NAME} payment failed`,
    text: `Your ${APP_NAME} ${planName} payment failed. Update your payment method by ${graceDate} to keep your subscription.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Payment failed</h2>
        <p>Your ${APP_NAME} <strong>${planName}</strong> payment failed.</p>
        <p>Your subscription will remain active until <strong>${graceDate}</strong>. Please update your payment method to avoid losing access.</p>
        <a href="${APP_URL}/billing" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Update Payment Method</a>
      </div>`,
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
  await sendEmail({
    to: email,
    subject: `Your ${APP_NAME} subscription has been canceled`,
    text: `Your ${APP_NAME} ${planName} subscription has been canceled. You'll have access until ${endDate}.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Subscription canceled</h2>
        <p>Your ${APP_NAME} <strong>${planName}</strong> subscription has been canceled.</p>
        <p>You'll continue to have access to all ${planName} features until <strong>${endDate}</strong>.</p>
        <a href="${APP_URL}/billing" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Reactivate Subscription</a>
      </div>`,
  });
}
