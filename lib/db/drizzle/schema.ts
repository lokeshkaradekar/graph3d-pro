import { pgTable, unique, uuid, text, timestamp, integer, boolean, bigint, jsonb, bigserial, smallint, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const auditActorType = pgEnum("audit_actor_type", ['user', 'admin', 'system', 'webhook'])
export const billingProvider = pgEnum("billing_provider", ['stripe', 'razorpay', 'paddle', 'manual'])
export const featureGrantSource = pgEnum("feature_grant_source", ['admin', 'plan_bonus', 'coupon', 'referral', 'promotion'])
export const graphVisibility = pgEnum("graph_visibility", ['private', 'public', 'shared'])
export const notificationType = pgEnum("notification_type", ['subscription_created', 'subscription_renewed', 'subscription_expiring', 'subscription_expired', 'subscription_canceled', 'payment_succeeded', 'payment_failed', 'payment_refunded', 'email_verified', 'feature_granted', 'feature_revoked', 'graph_shared', 'admin_message'])
export const paymentEventStatus = pgEnum("payment_event_status", ['pending', 'processed', 'failed', 'ignored'])
export const paymentStatus = pgEnum("payment_status", ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'])
export const subscriptionStatus = pgEnum("subscription_status", ['trialing', 'active', 'past_due', 'grace_period', 'canceled', 'expired'])
export const usageMetric = pgEnum("usage_metric", ['ai_requests', 'storage_bytes', 'exports', 'graphs_created', 'api_requests', 'gpu_renders', 'compute_seconds'])
export const userRole = pgEnum("user_role", ['user', 'admin'])


export const emailVerifications = pgTable("email_verifications", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("email_verifications_token_hash_unique").on(table.tokenHash),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	ipAddress: text("ip_address"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("password_reset_tokens_token_hash_unique").on(table.tokenHash),
]);

export const plans = pgTable("plans", {
	id: uuid().primaryKey().notNull(),
	slug: text().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	priceMonthlyCents: integer("price_monthly_cents").default(0).notNull(),
	priceYearlyCents: integer("price_yearly_cents").default(0).notNull(),
	currency: text().default('USD').notNull(),
	maxSeats: integer("max_seats"),
	isActive: boolean("is_active").default(true).notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const planFeatures = pgTable("plan_features", {
	id: uuid().primaryKey().notNull(),
	planId: uuid("plan_id").notNull(),
	featureName: text("feature_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	limitValue: bigint("limit_value", { mode: "number" }),
	limitPeriod: text("limit_period"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("plan_features_plan_feature_unique").on(table.planId, table.featureName),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	planId: uuid("plan_id").notNull(),
	status: subscriptionStatus().default('active').notNull(),
	provider: billingProvider(),
	providerSubscriptionId: text("provider_subscription_id"),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const userFeatures = pgTable("user_features", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	featureName: text("feature_name").notNull(),
	grantedBy: featureGrantSource("granted_by").default('admin').notNull(),
	grantedByRef: text("granted_by_ref"),
	limitValue: integer("limit_value"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_features_user_feature_unique").on(table.userId, table.featureName),
]);

export const users = pgTable("users", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	displayName: text("display_name"),
	plan: text().default('free').notNull(),
	failedLoginAttempts: smallint("failed_login_attempts").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	tokenHash: text("token_hash").notNull(),
	userAgent: text("user_agent"),
	ipAddress: text("ip_address"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const graphs = pgTable("graphs", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	title: text().default('Untitled Graph').notNull(),
	data: jsonb().notNull(),
	isPublic: boolean("is_public").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	subscriptionId: uuid("subscription_id"),
	provider: billingProvider().notNull(),
	providerPaymentId: text("provider_payment_id").notNull(),
	amountCents: integer("amount_cents").notNull(),
	currency: text().default('USD').notNull(),
	status: paymentStatus().default('pending').notNull(),
	refundedAmountCents: integer("refunded_amount_cents").default(0).notNull(),
	metadata: jsonb(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const paymentEvents = pgTable("payment_events", {
	id: uuid().primaryKey().notNull(),
	provider: billingProvider().notNull(),
	eventId: text("event_id").notNull(),
	eventType: text("event_type").notNull(),
	payload: jsonb(),
	status: paymentEventStatus().default('pending').notNull(),
	error: text(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("payment_events_provider_event_id_unique").on(table.provider, table.eventId),
]);

export const featureFlags = pgTable("feature_flags", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	enabledGlobally: boolean("enabled_globally").default(false).notNull(),
	rolloutPercentage: integer("rollout_percentage").default(0).notNull(),
	enabledForPlanSlugs: jsonb("enabled_for_plan_slugs"),
	killSwitchAt: timestamp("kill_switch_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const graphVersions = pgTable("graph_versions", {
	id: uuid().primaryKey().notNull(),
	graphId: uuid("graph_id").notNull(),
	userId: uuid("user_id").notNull(),
	versionNumber: integer("version_number").notNull(),
	label: text().default('manual').notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("graph_versions_graph_version_unique").on(table.versionNumber, table.graphId),
]);

export const usage = pgTable("usage", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	metric: usageMetric().notNull(),
	period: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	value: bigint({ mode: "number" }).default(0).notNull(),
	lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("usage_user_metric_period_unique").on(table.userId, table.period, table.metric),
]);

export const apiKeys = pgTable("api_keys", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	keyHash: text("key_hash").notNull(),
	keyPrefix: text("key_prefix").notNull(),
	name: text().notNull(),
	scopes: jsonb().default([]).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("api_keys_key_hash_unique").on(table.keyHash),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().primaryKey().notNull(),
	actorId: text("actor_id"),
	actorType: auditActorType("actor_type").default('user').notNull(),
	action: text().notNull(),
	resourceType: text("resource_type"),
	resourceId: text("resource_id"),
	metadata: jsonb(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: notificationType().notNull(),
	title: text().notNull(),
	body: text(),
	actionUrl: text("action_url"),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
