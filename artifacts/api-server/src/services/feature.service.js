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
exports.getUserFeatures = getUserFeatures;
exports.hasFeature = hasFeature;
exports.grantFeature = grantFeature;
exports.revokeFeature = revokeFeature;
/**
 * Feature Service — the core of the subscription access control system.
 *
 * RULE: Never check plan names (user.plan === 'pro').
 * ALWAYS check: await featureService.hasFeature(userId, FEATURES.AI_ASSISTANT)
 *
 * Effective feature set for a user is the UNION of:
 *   1. Features included in their active subscription plan (plan_features)
 *   2. Features individually granted to them (user_features)
 *
 * Filtered by:
 *   - Global feature flags (kill-switch can disable regardless)
 *   - Subscription status (must be active/trialing/grace_period)
 *   - Individual feature expiry and revocation
 */
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var constants_1 = require("../lib/constants");
var crypto_1 = require("../lib/crypto");
/**
 * Get the effective plan for a user.
 * If they have no active subscription, they're on the free plan.
 */
function getEffectivePlanId(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var now, sub, freePlan;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    now = new Date();
                    return [4 /*yield*/, db_1.db
                            .select({ planId: db_2.subscriptionsTable.planId, status: db_2.subscriptionsTable.status, gracePeriodEndsAt: db_2.subscriptionsTable.gracePeriodEndsAt, currentPeriodEnd: db_2.subscriptionsTable.currentPeriodEnd, trialEndsAt: db_2.subscriptionsTable.trialEndsAt })
                            .from(db_2.subscriptionsTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "active"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "trialing"), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "grace_period"))))
                            .orderBy((0, drizzle_orm_1.desc)(db_2.subscriptionsTable.createdAt))
                            .limit(1)];
                case 1:
                    sub = (_b.sent())[0];
                    if (!!sub) return [3 /*break*/, 3];
                    return [4 /*yield*/, db_1.db
                            .select({ id: db_2.plansTable.id })
                            .from(db_2.plansTable)
                            .where((0, drizzle_orm_1.eq)(db_2.plansTable.slug, constants_1.FREE_PLAN_SLUG))
                            .limit(1)];
                case 2:
                    freePlan = (_b.sent())[0];
                    return [2 /*return*/, (_a = freePlan === null || freePlan === void 0 ? void 0 : freePlan.id) !== null && _a !== void 0 ? _a : null];
                case 3:
                    // Check if subscription is still within valid period
                    if (sub.status === "active") {
                        if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
                            // Period has ended — check if grace period applies
                            return [2 /*return*/, null]; // will fall back to free
                        }
                    }
                    else if (sub.status === "trialing") {
                        if (sub.trialEndsAt && sub.trialEndsAt < now)
                            return [2 /*return*/, null];
                    }
                    else if (sub.status === "grace_period") {
                        if (sub.gracePeriodEndsAt && sub.gracePeriodEndsAt < now)
                            return [2 /*return*/, null];
                    }
                    return [2 /*return*/, sub.planId];
            }
        });
    });
}
/** Get all effective features for a user */
function getUserFeatures(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var now, planId, planFeatures, _a, userGrants, grantedFeatures, featureMap, _i, planFeatures_1, pf, _b, grantedFeatures_1, gf;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = new Date();
                    return [4 /*yield*/, getEffectivePlanId(userId)];
                case 1:
                    planId = _c.sent();
                    if (!planId) return [3 /*break*/, 3];
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.planFeaturesTable)
                            .where((0, drizzle_orm_1.eq)(db_2.planFeaturesTable.planId, planId))];
                case 2:
                    _a = (_c.sent())
                        .filter(function (pf) { return pf.limitValue !== 0; }) // 0 = explicitly disabled
                        .map(function (pf) { return ({
                        featureName: pf.featureName,
                        source: "plan",
                        limitValue: pf.limitValue,
                        limitPeriod: pf.limitPeriod,
                    }); });
                    return [3 /*break*/, 4];
                case 3:
                    _a = [];
                    _c.label = 4;
                case 4:
                    planFeatures = _a;
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.userFeaturesTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.userFeaturesTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.userFeaturesTable.revokedAt), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(db_2.userFeaturesTable.expiresAt), (0, drizzle_orm_1.gt)(db_2.userFeaturesTable.expiresAt, now))))];
                case 5:
                    userGrants = _c.sent();
                    grantedFeatures = userGrants.map(function (ug) { return ({
                        featureName: ug.featureName,
                        source: "grant",
                        limitValue: ug.limitValue,
                        limitPeriod: null,
                    }); });
                    featureMap = new Map();
                    for (_i = 0, planFeatures_1 = planFeatures; _i < planFeatures_1.length; _i++) {
                        pf = planFeatures_1[_i];
                        featureMap.set(pf.featureName, pf);
                    }
                    for (_b = 0, grantedFeatures_1 = grantedFeatures; _b < grantedFeatures_1.length; _b++) {
                        gf = grantedFeatures_1[_b];
                        featureMap.set(gf.featureName, gf);
                    } // grants win
                    return [2 /*return*/, Array.from(featureMap.values())];
            }
        });
    });
}
/**
 * Primary access check.
 * This is the function that every protected endpoint calls.
 * Never bypass this with plan-name checks.
 */
function hasFeature(userId, featureName) {
    return __awaiter(this, void 0, void 0, function () {
        var flag, features, match, period, usageRow, used, remaining;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.featureFlagsTable)
                        .where((0, drizzle_orm_1.eq)(db_2.featureFlagsTable.name, featureName))
                        .limit(1)];
                case 1:
                    flag = (_c.sent())[0];
                    if (flag) {
                        // Kill switch active
                        if (flag.killSwitchAt && flag.killSwitchAt <= new Date()) {
                            return [2 /*return*/, { allowed: false, reason: "Feature is temporarily disabled." }];
                        }
                        // Globally disabled with no rollout
                        if (!flag.enabledGlobally && flag.rolloutPercentage === 0) {
                            return [2 /*return*/, { allowed: false, reason: "Feature is not available." }];
                        }
                    }
                    return [4 /*yield*/, getUserFeatures(userId)];
                case 2:
                    features = _c.sent();
                    match = features.find(function (f) { return f.featureName === featureName; });
                    if (!match) {
                        return [2 /*return*/, { allowed: false, reason: "Your plan does not include this feature." }];
                    }
                    if (!(match.limitValue !== null && match.limitValue > 0)) return [3 /*break*/, 4];
                    period = match.limitPeriod === "yearly"
                        ? (0, crypto_1.currentYearPeriod)()
                        : match.limitPeriod === "monthly"
                            ? (0, crypto_1.currentMonthPeriod)()
                            : "all-time";
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.usageTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.usageTable.userId, userId), (0, drizzle_orm_1.eq)(db_2.usageTable.metric, featureName), (0, drizzle_orm_1.eq)(db_2.usageTable.period, period)))
                            .limit(1)];
                case 3:
                    usageRow = (_c.sent())[0];
                    used = Number((_a = usageRow === null || usageRow === void 0 ? void 0 : usageRow.value) !== null && _a !== void 0 ? _a : 0);
                    remaining = match.limitValue - used;
                    if (remaining <= 0) {
                        return [2 /*return*/, {
                                allowed: false,
                                reason: "You've reached your ".concat((_b = match.limitPeriod) !== null && _b !== void 0 ? _b : "", " limit for this feature."),
                                remaining: 0,
                            }];
                    }
                    return [2 /*return*/, { allowed: true, remaining: remaining }];
                case 4: 
                // Unlimited access
                return [2 /*return*/, { allowed: true, remaining: null }];
            }
        });
    });
}
/** Grant a feature to a user (admin or system action) */
function grantFeature(userId_1, featureName_1) {
    return __awaiter(this, arguments, void 0, function (userId, featureName, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .insert(db_2.userFeaturesTable)
                        .values({
                        userId: userId,
                        featureName: featureName,
                        grantedBy: (_a = options.grantedBy) !== null && _a !== void 0 ? _a : "admin",
                        grantedByRef: (_b = options.grantedByRef) !== null && _b !== void 0 ? _b : null,
                        limitValue: (_c = options.limitValue) !== null && _c !== void 0 ? _c : null,
                        expiresAt: (_d = options.expiresAt) !== null && _d !== void 0 ? _d : null,
                    })
                        .onConflictDoUpdate({
                        target: [db_2.userFeaturesTable.userId, db_2.userFeaturesTable.featureName],
                        set: {
                            grantedBy: (_e = options.grantedBy) !== null && _e !== void 0 ? _e : "admin",
                            grantedByRef: (_f = options.grantedByRef) !== null && _f !== void 0 ? _f : null,
                            limitValue: (_g = options.limitValue) !== null && _g !== void 0 ? _g : null,
                            expiresAt: (_h = options.expiresAt) !== null && _h !== void 0 ? _h : null,
                            revokedAt: null,
                        },
                    })];
                case 1:
                    _j.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** Revoke a feature from a user */
function revokeFeature(userId, featureName) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.userFeaturesTable)
                        .set({ revokedAt: new Date() })
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.userFeaturesTable.userId, userId), (0, drizzle_orm_1.eq)(db_2.userFeaturesTable.featureName, featureName), (0, drizzle_orm_1.isNull)(db_2.userFeaturesTable.revokedAt)))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
