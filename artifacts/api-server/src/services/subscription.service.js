"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.getActiveSubscription = getActiveSubscription;
exports.getSubscriptionHistory = getSubscriptionHistory;
exports.getPublicPlans = getPublicPlans;
exports.getPlanBySlug = getPlanBySlug;
exports.createFreeSubscription = createFreeSubscription;
exports.activatePaidSubscription = activatePaidSubscription;
exports.renewSubscription = renewSubscription;
exports.markSubscriptionPastDue = markSubscriptionPastDue;
exports.cancelSubscription = cancelSubscription;
exports.expireOverdueSubscriptions = expireOverdueSubscriptions;
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var constants_1 = require("../lib/constants");
var email_1 = require("../lib/email");
/** Get the currently active subscription for a user (including trialing/grace) */
function getActiveSubscription(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select({
                        subscription: db_2.subscriptionsTable,
                        plan: db_2.plansTable,
                    })
                        .from(db_2.subscriptionsTable)
                        .innerJoin(db_2.plansTable, (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.planId, db_2.plansTable.id))
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "active"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "trialing"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "grace_period"))))
                        .orderBy((0, drizzle_orm_1.desc)(db_2.subscriptionsTable.createdAt))
                        .limit(1)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, (_a = rows[0]) !== null && _a !== void 0 ? _a : null];
            }
        });
    });
}
/** Get subscription history for a user */
function getSubscriptionHistory(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.db
                    .select({
                    subscription: db_2.subscriptionsTable,
                    plan: db_2.plansTable,
                })
                    .from(db_2.subscriptionsTable)
                    .innerJoin(db_2.plansTable, (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.planId, db_2.plansTable.id))
                    .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, userId))
                    .orderBy((0, drizzle_orm_1.desc)(db_2.subscriptionsTable.createdAt))];
        });
    });
}
/** Get all public plans */
function getPublicPlans() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.db
                    .select()
                    .from(db_2.plansTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.plansTable.isActive, true), (0, drizzle_orm_1.eq)(db_2.plansTable.isPublic, true)))
                    .orderBy(db_2.plansTable.sortOrder)];
        });
    });
}
/** Get plan by slug */
function getPlanBySlug(slug) {
    return __awaiter(this, void 0, void 0, function () {
        var plan;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.plansTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.plansTable.slug, slug), (0, drizzle_orm_1.eq)(db_2.plansTable.isActive, true)))
                        .limit(1)];
                case 1:
                    plan = (_a.sent())[0];
                    return [2 /*return*/, plan !== null && plan !== void 0 ? plan : null];
            }
        });
    });
}
/** Create a free subscription for a new user */
function createFreeSubscription(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var freePlan, sub;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPlanBySlug(constants_1.FREE_PLAN_SLUG)];
                case 1:
                    freePlan = _a.sent();
                    if (!freePlan)
                        throw new Error("Free plan not found — run seed data");
                    return [4 /*yield*/, db_1.db
                            .insert(db_2.subscriptionsTable)
                            .values({
                            userId: userId,
                            planId: freePlan.id,
                            status: "active",
                            provider: null,
                        })
                            .returning()];
                case 2:
                    sub = (_a.sent())[0];
                    if (!sub)
                        throw new Error("Failed to create free subscription");
                    return [2 /*return*/, sub];
            }
        });
    });
}
/**
 * Activate a paid subscription after successful payment.
 * Called by the webhook processor.
 */
function activatePaidSubscription(params) {
    return __awaiter(this, void 0, void 0, function () {
        var sub;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                        var inserted;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, tx
                                        .update(db_2.subscriptionsTable)
                                        .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
                                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, params.userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "active"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "trialing"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "grace_period"))))];
                                case 1:
                                    _b.sent();
                                    return [4 /*yield*/, tx
                                            .insert(db_2.subscriptionsTable)
                                            .values({
                                            userId: params.userId,
                                            planId: params.planId,
                                            status: params.trialEndsAt ? "trialing" : "active",
                                            provider: params.provider,
                                            providerSubscriptionId: params.providerSubscriptionId,
                                            currentPeriodStart: params.currentPeriodStart,
                                            currentPeriodEnd: params.currentPeriodEnd,
                                            trialEndsAt: (_a = params.trialEndsAt) !== null && _a !== void 0 ? _a : null,
                                            metadata: params.metadata,
                                        })
                                            .returning()];
                                case 2:
                                    inserted = (_b.sent())[0];
                                    return [2 /*return*/, inserted];
                            }
                        });
                    }); })];
                case 1:
                    sub = _a.sent();
                    if (!sub)
                        throw new Error("Failed to activate subscription");
                    return [2 /*return*/, sub];
            }
        });
    });
}
/**
 * Handle subscription renewal (payment succeeded for renewal).
 */
function renewSubscription(providerSubscriptionId, newPeriodStart, newPeriodEnd) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.subscriptionsTable)
                        .set({
                        status: "active",
                        currentPeriodStart: newPeriodStart,
                        currentPeriodEnd: newPeriodEnd,
                        gracePeriodEndsAt: null,
                        cancelAtPeriodEnd: false,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.providerSubscriptionId, providerSubscriptionId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Mark subscription as past_due and start grace period.
 * Called when a payment fails.
 */
function markSubscriptionPastDue(providerSubscriptionId, userEmail, planName) {
    return __awaiter(this, void 0, void 0, function () {
        var gracePeriodEndsAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    gracePeriodEndsAt = new Date(Date.now() + constants_1.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, db_1.db
                            .update(db_2.subscriptionsTable)
                            .set({
                            status: "grace_period",
                            gracePeriodEndsAt: gracePeriodEndsAt,
                            updatedAt: new Date(),
                        })
                            .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.providerSubscriptionId, providerSubscriptionId))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, email_1.sendPaymentFailedEmail)(userEmail, planName, gracePeriodEndsAt)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Cancel a subscription.
 * If atPeriodEnd=true, access continues until currentPeriodEnd.
 * If atPeriodEnd=false (immediate), access is revoked now.
 */
function cancelSubscription(userId, subscriptionId, atPeriodEnd) {
    return __awaiter(this, void 0, void 0, function () {
        var sub, accessEndsAt;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select({ subscription: db_2.subscriptionsTable, plan: db_2.plansTable })
                        .from(db_2.subscriptionsTable)
                        .innerJoin(db_2.plansTable, (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.planId, db_2.plansTable.id))
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.id, subscriptionId), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, userId)))
                        .limit(1)];
                case 1:
                    sub = (_b.sent())[0];
                    if (!sub)
                        return [2 /*return*/];
                    if (!atPeriodEnd) return [3 /*break*/, 4];
                    return [4 /*yield*/, db_1.db
                            .update(db_2.subscriptionsTable)
                            .set({
                            cancelAtPeriodEnd: true,
                            canceledAt: new Date(),
                            updatedAt: new Date(),
                        })
                            .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.id, subscriptionId))];
                case 2:
                    _b.sent();
                    accessEndsAt = (_a = sub.subscription.currentPeriodEnd) !== null && _a !== void 0 ? _a : new Date();
                    return [4 /*yield*/, (0, email_1.sendSubscriptionCanceledEmail)(sub.subscription.userId, // We'd need user email here — pass it in
                        sub.plan.displayName, accessEndsAt)];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, db_1.db
                        .update(db_2.subscriptionsTable)
                        .set({
                        status: "canceled",
                        canceledAt: new Date(),
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.id, subscriptionId))];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
/** Expire all subscriptions whose grace period has ended */
function expireOverdueSubscriptions() {
    return __awaiter(this, void 0, void 0, function () {
        var now;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = new Date();
                    return [4 /*yield*/, db_1.db
                            .update(db_2.subscriptionsTable)
                            .set({ status: "expired", updatedAt: now })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "grace_period"), (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " < ", ""], ["", " < ", ""])), db_2.subscriptionsTable.gracePeriodEndsAt, now.toISOString())))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var templateObject_1;
