import { pgEnum } from "drizzle-orm/pg-core";

// User roles
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

// Session status (via expires_at check, not a column, but keep enum for audit)
// No enum needed — handled by timestamp

// Subscription statuses
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "grace_period",
  "canceled",
  "expired",
]);

// Billing providers
export const billingProviderEnum = pgEnum("billing_provider", [
  "stripe",
  "razorpay",
  "paddle",
  "manual",
]);

// Payment statuses
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

// Payment event processing statuses
export const paymentEventStatusEnum = pgEnum("payment_event_status", [
  "pending",
  "processed",
  "failed",
  "ignored",
]);

// How a user feature was granted
export const featureGrantSourceEnum = pgEnum("feature_grant_source", [
  "admin",
  "plan_bonus",
  "coupon",
  "referral",
  "promotion",
]);

// Graph visibility
export const graphVisibilityEnum = pgEnum("graph_visibility", [
  "private",
  "public",
  "shared",
]);

// Usage metrics
export const usageMetricEnum = pgEnum("usage_metric", [
  "ai_requests",
  "storage_bytes",
  "exports",
  "graphs_created",
  "api_requests",
  "gpu_renders",
  "compute_seconds",
]);

// Audit log actor types
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "admin",
  "system",
  "webhook",
]);

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "subscription_created",
  "subscription_renewed",
  "subscription_expiring",
  "subscription_expired",
  "subscription_canceled",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "email_verified",
  "feature_granted",
  "feature_revoked",
  "graph_shared",
  "admin_message",
]);
