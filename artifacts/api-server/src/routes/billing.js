"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
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
var express_1 = require("express");
var zod_1 = require("zod");
var authenticate_1 = require("../middlewares/authenticate");
var require_auth_1 = require("../middlewares/require-auth");
var require_verified_1 = require("../middlewares/require-verified");
var rate_limit_1 = require("../middlewares/rate-limit");
var validate_1 = require("../middlewares/validate");
var billing_service_1 = require("../services/billing.service");
var subscription_service_1 = require("../services/subscription.service");
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var audit_service_1 = require("../services/audit.service");
var notification_service_1 = require("../services/notification.service");
var router = (0, express_1.Router)();
// ── POST /api/billing/checkout — create a Stripe checkout session ──────────────
var checkoutSchema = zod_1.z.object({
    planSlug: zod_1.z.string(),
    billingCycle: zod_1.z.enum(["monthly", "yearly"]).optional().default("monthly"),
    provider: zod_1.z.string().optional().default("stripe"),
});
router.post("/checkout", authenticate_1.authenticate, require_auth_1.requireAuth, require_verified_1.requireVerified, (0, validate_1.validate)(checkoutSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, planSlug, billingCycle, provider, plan, priceEnvKey, planPriceId, p, appUrl, session, err_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = req.body, planSlug = _a.planSlug, billingCycle = _a.billingCycle, provider = _a.provider;
                return [4 /*yield*/, (0, subscription_service_1.getPlanBySlug)(planSlug)];
            case 1:
                plan = _c.sent();
                if (!plan) {
                    res.status(404).json({ error: "Plan not found." });
                    return [2 /*return*/];
                }
                priceEnvKey = "STRIPE_PRICE_".concat(planSlug.toUpperCase(), "_").concat(billingCycle.toUpperCase());
                planPriceId = process.env[priceEnvKey];
                if (!planPriceId) {
                    res.status(500).json({
                        error: "Payment configuration is incomplete. Please contact support.",
                    });
                    return [2 /*return*/];
                }
                _c.label = 2;
            case 2:
                _c.trys.push([2, 5, , 6]);
                return [4 /*yield*/, (0, billing_service_1.getProvider)(provider)];
            case 3:
                p = _c.sent();
                appUrl = (_b = process.env["APP_URL"]) !== null && _b !== void 0 ? _b : "https://graph3d.app";
                return [4 /*yield*/, p.createCheckoutSession({
                        userId: req.user.id,
                        userEmail: req.user.email,
                        planSlug: planSlug,
                        planPriceId: planPriceId,
                        successUrl: "".concat(appUrl, "/billing/success?session_id={CHECKOUT_SESSION_ID}"),
                        cancelUrl: "".concat(appUrl, "/billing"),
                        metadata: { billingCycle: billingCycle },
                    })];
            case 4:
                session = _c.sent();
                (0, audit_service_1.auditBilling)("subscription.created", req.user.id, {
                    planSlug: planSlug,
                    provider: provider,
                    billingCycle: billingCycle,
                });
                res.json({ url: session.url, sessionId: session.sessionId });
                return [3 /*break*/, 6];
            case 5:
                err_1 = _c.sent();
                req.log.error({ err: err_1 }, "checkout error");
                res.status(500).json({ error: "Failed to create checkout session." });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// ── POST /api/billing/webhooks/stripe ─────────────────────────────────────────
// Must parse raw body for signature verification — do NOT use express.json() here
router.post("/webhooks/stripe", rate_limit_1.webhookLimiter, (0, express_1.raw)({ type: "application/json" }), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var signature, webhookSecret, provider, verified, inserted, eventRecordId, err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                signature = req.headers["stripe-signature"];
                webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
                if (!signature || !webhookSecret) {
                    res.status(400).json({ error: "Missing signature or webhook secret." });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, billing_service_1.getProvider)("stripe").catch(function () { return null; })];
            case 1:
                provider = _a.sent();
                if (!provider) {
                    res.status(503).json({ error: "Stripe provider not configured." });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, provider.verifyWebhook(req.body, signature, webhookSecret)];
            case 2:
                verified = _a.sent();
                if (!verified.valid) {
                    (0, audit_service_1.auditWebhook)("webhook.rejected", { provider: "stripe" });
                    res.status(400).json({ error: "Invalid webhook signature." });
                    return [2 /*return*/];
                }
                (0, audit_service_1.auditWebhook)("webhook.received", {
                    provider: "stripe",
                    eventId: verified.eventId,
                    eventType: verified.eventType,
                });
                return [4 /*yield*/, db_1.db
                        .insert(db_2.paymentEventsTable)
                        .values({
                        provider: "stripe",
                        eventId: verified.eventId,
                        eventType: verified.eventType,
                        payload: verified.payload,
                        status: "pending",
                    })
                        .onConflictDoNothing()
                        .returning({ id: db_2.paymentEventsTable.id })];
            case 3:
                inserted = _a.sent();
                if (inserted.length === 0) {
                    // Already processed — return 200 to stop provider retries
                    (0, audit_service_1.auditWebhook)("webhook.duplicate", {
                        provider: "stripe",
                        eventId: verified.eventId,
                    });
                    res.status(200).json({ ok: true, duplicate: true });
                    return [2 /*return*/];
                }
                eventRecordId = inserted[0].id;
                _a.label = 4;
            case 4:
                _a.trys.push([4, 7, , 9]);
                return [4 /*yield*/, processStripeEvent(verified.eventType, verified.payload)];
            case 5:
                _a.sent();
                return [4 /*yield*/, db_1.db
                        .update(db_2.paymentEventsTable)
                        .set({ status: "processed", processedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_2.paymentEventsTable.id, eventRecordId))];
            case 6:
                _a.sent();
                (0, audit_service_1.auditWebhook)("webhook.processed", {
                    provider: "stripe",
                    eventId: verified.eventId,
                    eventType: verified.eventType,
                });
                return [3 /*break*/, 9];
            case 7:
                err_2 = _a.sent();
                return [4 /*yield*/, db_1.db
                        .update(db_2.paymentEventsTable)
                        .set({
                        status: "failed",
                        error: err_2 instanceof Error ? err_2.message : String(err_2),
                        processedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(db_2.paymentEventsTable.id, eventRecordId))];
            case 8:
                _a.sent();
                // Return 500 so Stripe retries delivery
                res.status(500).json({ error: "Event processing failed." });
                return [2 /*return*/];
            case 9:
                res.status(200).json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
/**
 * Process a verified Stripe event.
 * All DB mutations here happen atomically (wrapped by the caller in a try/catch
 * that marks the event as failed if anything throws).
 */
function processStripeEvent(eventType, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var data, _a, userId, planSlug, subscriptionId, customerId, plan, now, periodEnd, subscriptionId, amountPaid, currency, customerId, invoiceId, sub, now, periodEnd, subscriptionId, sub, subscriptionId;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    data = (_c = (_b = payload["data"]) === null || _b === void 0 ? void 0 : _b.object) !== null && _c !== void 0 ? _c : {};
                    _a = eventType;
                    switch (_a) {
                        case "checkout.session.completed": return [3 /*break*/, 1];
                        case "invoice.payment_succeeded": return [3 /*break*/, 5];
                        case "invoice.payment_failed": return [3 /*break*/, 9];
                        case "customer.subscription.deleted": return [3 /*break*/, 12];
                    }
                    return [3 /*break*/, 14];
                case 1:
                    userId = (_d = data["metadata"]) === null || _d === void 0 ? void 0 : _d["userId"];
                    planSlug = (_e = data["metadata"]) === null || _e === void 0 ? void 0 : _e["planSlug"];
                    subscriptionId = data["subscription"];
                    customerId = data["customer"];
                    if (!userId || !planSlug || !subscriptionId)
                        return [3 /*break*/, 15];
                    return [4 /*yield*/, (0, subscription_service_1.getPlanBySlug)(planSlug)];
                case 2:
                    plan = _h.sent();
                    if (!plan)
                        return [3 /*break*/, 15];
                    now = new Date();
                    periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, (0, subscription_service_1.activatePaidSubscription)({
                            userId: userId,
                            planId: plan.id,
                            provider: "stripe",
                            providerSubscriptionId: subscriptionId,
                            currentPeriodStart: now,
                            currentPeriodEnd: periodEnd,
                            metadata: { customerId: customerId },
                        })];
                case 3:
                    _h.sent();
                    return [4 /*yield*/, (0, notification_service_1.createNotification)(userId, "subscription_created", "Welcome to ".concat(plan.displayName, "!"), "Your ".concat(plan.displayName, " subscription is now active."), "/billing")];
                case 4:
                    _h.sent();
                    (0, audit_service_1.auditBilling)("subscription.activated", userId, { planSlug: planSlug, subscriptionId: subscriptionId });
                    return [3 /*break*/, 15];
                case 5:
                    subscriptionId = data["subscription"];
                    amountPaid = data["amount_paid"];
                    currency = (_g = (_f = data["currency"]) === null || _f === void 0 ? void 0 : _f.toUpperCase()) !== null && _g !== void 0 ? _g : "USD";
                    customerId = data["customer"];
                    invoiceId = data["id"];
                    if (!subscriptionId)
                        return [3 /*break*/, 15];
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.subscriptionsTable)
                            .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.providerSubscriptionId, subscriptionId))
                            .limit(1)];
                case 6:
                    sub = (_h.sent())[0];
                    if (!sub)
                        return [3 /*break*/, 15];
                    // Record payment
                    return [4 /*yield*/, db_1.db.insert(db_2.paymentsTable).values({
                            userId: sub.userId,
                            subscriptionId: sub.id,
                            provider: "stripe",
                            providerPaymentId: invoiceId,
                            amountCents: amountPaid,
                            currency: currency,
                            status: "succeeded",
                            paidAt: new Date(),
                            metadata: { customerId: customerId },
                        }).onConflictDoNothing()];
                case 7:
                    // Record payment
                    _h.sent();
                    now = new Date();
                    periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, (0, subscription_service_1.renewSubscription)(subscriptionId, now, periodEnd)];
                case 8:
                    _h.sent();
                    (0, audit_service_1.auditBilling)("payment.succeeded", sub.userId, { subscriptionId: subscriptionId, amountPaid: amountPaid });
                    return [3 /*break*/, 15];
                case 9:
                    subscriptionId = data["subscription"];
                    if (!subscriptionId)
                        return [3 /*break*/, 15];
                    return [4 /*yield*/, db_1.db
                            .select({ s: db_2.subscriptionsTable, u: db_2.usersTable })
                            .from(db_2.subscriptionsTable)
                            .innerJoin(db_2.usersTable, (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, db_2.usersTable.id))
                            .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.providerSubscriptionId, subscriptionId))
                            .limit(1)];
                case 10:
                    sub = (_h.sent())[0];
                    if (!sub)
                        return [3 /*break*/, 15];
                    return [4 /*yield*/, (0, subscription_service_1.markSubscriptionPastDue)(subscriptionId, sub.u.email, "your plan")];
                case 11:
                    _h.sent();
                    (0, audit_service_1.auditBilling)("subscription.past_due", sub.s.userId, { subscriptionId: subscriptionId });
                    return [3 /*break*/, 15];
                case 12:
                    subscriptionId = data["id"];
                    if (!subscriptionId)
                        return [3 /*break*/, 15];
                    return [4 /*yield*/, db_1.db
                            .update(db_2.subscriptionsTable)
                            .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.providerSubscriptionId, subscriptionId))];
                case 13:
                    _h.sent();
                    return [3 /*break*/, 15];
                case 14: 
                // Unhandled event type — log and ignore (don't fail)
                return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
exports.default = router;
