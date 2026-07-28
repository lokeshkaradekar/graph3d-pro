import { logger } from "../logger.js";
import { FROM_EMAIL } from "./brand.js";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Forwarded to the provider so a retried send can't duplicate a delivery. */
  idempotencyKey?: string;
}

/**
 * Everything in this module talks to `EmailProvider`, never to Resend (or
 * any other vendor) directly. Switching providers later means writing one
 * new class here and changing the single line in `index.ts` that
 * constructs it — nothing else in the codebase imports Resend.
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Dev-mode provider — logs instead of sending. Local development never
 * needs a real API key, and nothing gets emailed to real addresses by
 * accident while testing.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject, preview: message.text.slice(0, 200) },
      "[DEV] Email suppressed — would send",
    );
  }
}

/**
 * Resend provider, implemented as a plain `fetch()` call against Resend's
 * REST API rather than the `resend` npm package. The request is five
 * fields and one auth header — not worth a dependency for — and a hand
 * written fetch call has zero Node-specific internals, so it runs
 * unchanged under both the current Express deployment and the planned
 * Cloudflare Workers migration.
 * Reference: https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<void> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    // Idempotency-Key: Resend dedupes any request with the same key + the
    // same payload for 24h, so a retried send (timeout, transient 5xx)
    // can never result in a duplicate email reaching the user.
    if (message.idempotencyKey) {
      headers["Idempotency-Key"] = message.idempotencyKey;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error(
        { status: res.status, body: body.slice(0, 500), to: message.to },
        "Resend email send failed",
      );
      throw new Error(`Resend API error (${res.status}): failed to send email`);
    }
  }
}
