/**
 * Audit Service — immutable log of every sensitive action.
 *
 * Design principles:
 * - Fire-and-forget: audit logging never blocks the request
 * - Never fails silently in prod: errors are logged but don't propagate
 * - Structured: action names follow '<service>.<event>' convention
 * - Redacted: no passwords, tokens, raw PII beyond user IDs
 */
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Request } from "express";
import type { SessionUser } from "./session.service";

export type AuditAction =
  // Auth
  | "auth.signup"
  | "auth.login_success"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.logout_all"
  | "auth.password_changed"
  | "auth.password_reset_requested"
  | "auth.email_verified"
  | "auth.email_verification_resent"
  | "auth.account_locked"
  // Subscription
  | "subscription.created"
  | "subscription.activated"
  | "subscription.renewed"
  | "subscription.canceled"
  | "subscription.expired"
  | "subscription.past_due"
  | "subscription.reactivated"
  // Payment
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  // Feature
  | "feature.granted"
  | "feature.revoked"
  // Graph
  | "graph.created"
  | "graph.updated"
  | "graph.deleted"
  | "graph.shared"
  | "graph.visibility_changed"
  // Admin
  | "admin.user_viewed"
  | "admin.user_suspended"
  | "admin.plan_created"
  | "admin.plan_updated"
  | "admin.feature_flag_toggled"
  // Webhook
  | "webhook.received"
  | "webhook.processed"
  | "webhook.rejected"
  | "webhook.duplicate";

export interface AuditParams {
  actorId?: string | null;
  actorType?: "user" | "admin" | "system" | "webhook";
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Log an audit event. Non-blocking — never awaited in the request path.
 * Call as: audit({ ... }) — no await
 */
export function audit(params: AuditParams): void {
  setImmediate(async () => {
    try {
      const req = params.req;
      const ipAddress = req
        ? getIpFromRequest(req)
        : null;
      const userAgent = req?.headers["user-agent"] ?? null;

      await db.insert(auditLogsTable).values({
        actorId: params.actorId ?? null,
        actorType: params.actorType ?? "user",
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        metadata: params.metadata ?? null,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      // Audit log failure must never crash the application
      logger.error({ err, action: params.action }, "Failed to write audit log");
    }
  });
}

function getIpFromRequest(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  if (Array.isArray(forwarded)) return forwarded[0] ?? null;
  return req.socket?.remoteAddress ?? null;
}

/** Helper: log auth events with user context */
export function auditAuth(
  action: AuditAction,
  user: Pick<SessionUser, "id"> | null,
  req: Request,
  metadata?: Record<string, unknown>,
): void {
  audit({
    actorId: user?.id ?? null,
    actorType: "user",
    action,
    resourceType: "user",
    resourceId: user?.id,
    metadata,
    req,
  });
}

/** Helper: log subscription/billing events */
export function auditBilling(
  action: AuditAction,
  userId: string,
  metadata?: Record<string, unknown>,
): void {
  audit({
    actorId: userId,
    actorType: "user",
    action,
    resourceType: "subscription",
    metadata,
  });
}

/** Helper: log webhook events */
export function auditWebhook(
  action: AuditAction,
  metadata?: Record<string, unknown>,
): void {
  audit({
    actorType: "webhook",
    action,
    resourceType: "payment_event",
    metadata,
  });
}
