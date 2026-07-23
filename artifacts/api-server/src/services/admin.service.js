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
exports.adminListUsers = adminListUsers;
exports.adminCreatePlan = adminCreatePlan;
exports.adminSetPlanFeatures = adminSetPlanFeatures;
exports.adminSetFeatureFlag = adminSetFeatureFlag;
exports.adminGetDashboardStats = adminGetDashboardStats;
exports.adminGetAuditLogs = adminGetAuditLogs;
exports.adminGetWebhookEvents = adminGetWebhookEvents;
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
function adminListUsers(search_1) {
    return __awaiter(this, arguments, void 0, function (search, limit, offset) {
        var whereClause, _a, usersQuery, countQuery;
        var _b, _c;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    whereClause = search
                        ? (0, drizzle_orm_1.ilike)(db_2.usersTable.emailNormalized, "%".concat(search.toLowerCase(), "%"))
                        : undefined;
                    return [4 /*yield*/, Promise.all([
                            db_1.db
                                .select({
                                id: db_2.usersTable.id,
                                email: db_2.usersTable.email,
                                displayName: db_2.usersTable.displayName,
                                role: db_2.usersTable.role,
                                isVerified: db_2.usersTable.isVerified,
                                createdAt: db_2.usersTable.createdAt,
                                deletedAt: db_2.usersTable.deletedAt,
                                planSlug: db_2.plansTable.slug,
                            })
                                .from(db_2.usersTable)
                                .leftJoin(db_2.subscriptionsTable, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.subscriptionsTable.userId, db_2.usersTable.id), (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.status, "active")))
                                .leftJoin(db_2.plansTable, (0, drizzle_orm_1.eq)(db_2.subscriptionsTable.planId, db_2.plansTable.id))
                                .where(whereClause)
                                .orderBy((0, drizzle_orm_1.desc)(db_2.usersTable.createdAt))
                                .limit(limit)
                                .offset(offset),
                            db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(db_2.usersTable)
                                .where(whereClause),
                        ])];
                case 1:
                    _a = _d.sent(), usersQuery = _a[0], countQuery = _a[1];
                    return [2 /*return*/, {
                            users: usersQuery.map(function (u) {
                                var _a;
                                return ({
                                    id: u.id,
                                    email: u.email,
                                    displayName: u.displayName,
                                    role: u.role,
                                    isVerified: u.isVerified,
                                    createdAt: u.createdAt,
                                    deletedAt: u.deletedAt,
                                    activePlan: (_a = u.planSlug) !== null && _a !== void 0 ? _a : null,
                                });
                            }),
                            total: (_c = (_b = countQuery[0]) === null || _b === void 0 ? void 0 : _b.count) !== null && _c !== void 0 ? _c : 0,
                        }];
            }
        });
    });
}
// ── Plans ─────────────────────────────────────────────────────────────────────
function adminCreatePlan(params) {
    return __awaiter(this, void 0, void 0, function () {
        var plan;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .insert(db_2.plansTable)
                        .values({
                        slug: params.slug,
                        displayName: params.displayName,
                        description: (_a = params.description) !== null && _a !== void 0 ? _a : null,
                        priceMonthlycents: params.priceMonthlycents,
                        priceYearlyCents: params.priceYearlyCents,
                        currency: (_b = params.currency) !== null && _b !== void 0 ? _b : "USD",
                        sortOrder: (_c = params.sortOrder) !== null && _c !== void 0 ? _c : 0,
                    })
                        .returning()];
                case 1:
                    plan = (_d.sent())[0];
                    if (!plan)
                        throw new Error("Failed to create plan");
                    return [2 /*return*/, plan];
            }
        });
    });
}
function adminSetPlanFeatures(planId, features) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // Replace all plan features
                                return [4 /*yield*/, tx
                                        .delete(db_2.planFeaturesTable)
                                        .where((0, drizzle_orm_1.eq)(db_2.planFeaturesTable.planId, planId))];
                                case 1:
                                    // Replace all plan features
                                    _a.sent();
                                    if (!(features.length > 0)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, tx.insert(db_2.planFeaturesTable).values(features.map(function (f) {
                                            var _a, _b;
                                            return ({
                                                planId: planId,
                                                featureName: f.featureName,
                                                limitValue: (_a = f.limitValue) !== null && _a !== void 0 ? _a : null,
                                                limitPeriod: (_b = f.limitPeriod) !== null && _b !== void 0 ? _b : null,
                                            });
                                        }))];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ── Feature flags ─────────────────────────────────────────────────────────────
function adminSetFeatureFlag(name, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .insert(db_2.featureFlagsTable)
                        .values({
                        name: name,
                        description: (_a = options.description) !== null && _a !== void 0 ? _a : null,
                        enabledGlobally: (_b = options.enabledGlobally) !== null && _b !== void 0 ? _b : false,
                        rolloutPercentage: (_c = options.rolloutPercentage) !== null && _c !== void 0 ? _c : 0,
                    })
                        .onConflictDoUpdate({
                        target: db_2.featureFlagsTable.name,
                        set: {
                            enabledGlobally: (_d = options.enabledGlobally) !== null && _d !== void 0 ? _d : false,
                            rolloutPercentage: (_e = options.rolloutPercentage) !== null && _e !== void 0 ? _e : 0,
                            description: (_f = options.description) !== null && _f !== void 0 ? _f : null,
                            updatedAt: new Date(),
                        },
                    })];
                case 1:
                    _g.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ── Dashboard stats ───────────────────────────────────────────────────────────
function adminGetDashboardStats() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, userStats, subStats, paymentStats;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      SELECT\n        COUNT(*) AS total,\n        COUNT(*) FILTER (WHERE is_verified = true) AS verified\n      FROM users WHERE deleted_at IS NULL\n    "], ["\n      SELECT\n        COUNT(*) AS total,\n        COUNT(*) FILTER (WHERE is_verified = true) AS verified\n      FROM users WHERE deleted_at IS NULL\n    "])))),
                        db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      SELECT COUNT(*) AS active\n      FROM subscriptions\n      WHERE status IN ('active', 'trialing')\n    "], ["\n      SELECT COUNT(*) AS active\n      FROM subscriptions\n      WHERE status IN ('active', 'trialing')\n    "])))),
                        db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      SELECT\n        COALESCE(SUM(amount_cents), 0) AS total_cents,\n        COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS recent\n      FROM payments WHERE status = 'succeeded'\n    "], ["\n      SELECT\n        COALESCE(SUM(amount_cents), 0) AS total_cents,\n        COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS recent\n      FROM payments WHERE status = 'succeeded'\n    "])))),
                    ])];
                case 1:
                    _a = _m.sent(), userStats = _a[0], subStats = _a[1], paymentStats = _a[2];
                    return [2 /*return*/, {
                            totalUsers: Number((_c = (_b = userStats.rows[0]) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : 0),
                            verifiedUsers: Number((_e = (_d = userStats.rows[0]) === null || _d === void 0 ? void 0 : _d.verified) !== null && _e !== void 0 ? _e : 0),
                            activeSubscriptions: Number((_g = (_f = subStats.rows[0]) === null || _f === void 0 ? void 0 : _f.active) !== null && _g !== void 0 ? _g : 0),
                            totalRevenueCents: Number((_j = (_h = paymentStats.rows[0]) === null || _h === void 0 ? void 0 : _h.total_cents) !== null && _j !== void 0 ? _j : 0),
                            recentPayments: Number((_l = (_k = paymentStats.rows[0]) === null || _k === void 0 ? void 0 : _k.recent) !== null && _l !== void 0 ? _l : 0),
                        }];
            }
        });
    });
}
// ── Audit logs ────────────────────────────────────────────────────────────────
function adminGetAuditLogs() {
    return __awaiter(this, arguments, void 0, function (options) {
        var conditions;
        var _a, _b;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            conditions = [];
            if (options.actorId)
                conditions.push((0, drizzle_orm_1.eq)(db_2.auditLogsTable.actorId, options.actorId));
            if (options.action)
                conditions.push((0, drizzle_orm_1.eq)(db_2.auditLogsTable.action, options.action));
            if (options.resourceType)
                conditions.push((0, drizzle_orm_1.eq)(db_2.auditLogsTable.resourceType, options.resourceType));
            return [2 /*return*/, db_1.db
                    .select()
                    .from(db_2.auditLogsTable)
                    .where(conditions.length > 0 ? drizzle_orm_1.and.apply(void 0, conditions) : undefined)
                    .orderBy((0, drizzle_orm_1.desc)(db_2.auditLogsTable.createdAt))
                    .limit((_a = options.limit) !== null && _a !== void 0 ? _a : 50)
                    .offset((_b = options.offset) !== null && _b !== void 0 ? _b : 0)];
        });
    });
}
// ── Webhook history ───────────────────────────────────────────────────────────
function adminGetWebhookEvents() {
    return __awaiter(this, arguments, void 0, function (limit) {
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.db
                    .select()
                    .from(db_2.paymentEventsTable)
                    .orderBy((0, drizzle_orm_1.desc)(db_2.paymentEventsTable.createdAt))
                    .limit(limit)];
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3;
