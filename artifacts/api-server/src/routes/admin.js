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
var express_1 = require("express");
var zod_1 = require("zod");
var authenticate_1 = require("../middlewares/authenticate");
var require_admin_1 = require("../middlewares/require-admin");
var validate_1 = require("../middlewares/validate");
var admin_service_1 = require("../services/admin.service");
var feature_service_1 = require("../services/feature.service");
var audit_service_1 = require("../services/audit.service");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var router = (0, express_1.Router)();
// All admin routes require admin role
router.use(authenticate_1.authenticate, require_admin_1.requireAdmin);
// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var stats;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, admin_service_1.adminGetDashboardStats)()];
            case 1:
                stats = _a.sent();
                res.json(stats);
                return [2 /*return*/];
        }
    });
}); });
// ── GET /api/admin/users ──────────────────────────────────────────────────────
var listUsersQuery = zod_1.z.object({
    search: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().min(1).max(200).optional().default(50),
    offset: zod_1.z.coerce.number().min(0).optional().default(0),
});
router.get("/users", (0, validate_1.validateQuery)(listUsersQuery), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, search, limit, offset, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.query, search = _a.search, limit = _a.limit, offset = _a.offset;
                return [4 /*yield*/, (0, admin_service_1.adminListUsers)(search, limit, offset)];
            case 1:
                result = _b.sent();
                res.json(result);
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/admin/users/:userId/grant-feature ───────────────────────────────
var grantFeatureSchema = zod_1.z.object({
    featureName: zod_1.z.string().min(1),
    limitValue: zod_1.z.number().int().min(0).nullable().optional(),
    expiresAt: zod_1.z.string().datetime().nullable().optional(),
});
router.post("/users/:userId/grant-feature", (0, validate_1.validate)(grantFeatureSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, featureName, limitValue, expiresAt;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                userId = String(req.params["userId"]);
                _a = req.body, featureName = _a.featureName, limitValue = _a.limitValue, expiresAt = _a.expiresAt;
                return [4 /*yield*/, (0, feature_service_1.grantFeature)(userId, featureName, {
                        grantedBy: "admin",
                        grantedByRef: req.user.id,
                        limitValue: limitValue !== null && limitValue !== void 0 ? limitValue : null,
                        expiresAt: expiresAt ? new Date(expiresAt) : null,
                    })];
            case 1:
                _b.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    actorType: "admin",
                    action: "feature.granted",
                    resourceType: "user",
                    resourceId: userId,
                    metadata: { featureName: featureName, limitValue: limitValue, expiresAt: expiresAt },
                    req: req,
                });
                res.json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/admin/users/:userId/revoke-feature ──────────────────────────────
var revokeFeatureSchema = zod_1.z.object({ featureName: zod_1.z.string().min(1) });
router.post("/users/:userId/revoke-feature", (0, validate_1.validate)(revokeFeatureSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                userId = String(req.params["userId"]);
                return [4 /*yield*/, (0, feature_service_1.revokeFeature)(userId, req.body.featureName)];
            case 1:
                _a.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    actorType: "admin",
                    action: "feature.revoked",
                    resourceType: "user",
                    resourceId: userId,
                    metadata: { featureName: req.body.featureName },
                    req: req,
                });
                res.json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── GET /api/admin/plans ──────────────────────────────────────────────────────
router.get("/plans", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var plans;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, db_1.db.select().from(db_2.plansTable).orderBy(db_2.plansTable.sortOrder)];
            case 1:
                plans = _a.sent();
                res.json({ plans: plans });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/admin/plans ─────────────────────────────────────────────────────
var createPlanSchema = zod_1.z.object({
    slug: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    displayName: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    priceMonthlycents: zod_1.z.number().int().min(0),
    priceYearlyCents: zod_1.z.number().int().min(0),
    currency: zod_1.z.string().length(3).optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
router.post("/plans", (0, validate_1.validate)(createPlanSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var plan;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, admin_service_1.adminCreatePlan)(req.body)];
            case 1:
                plan = _a.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    actorType: "admin",
                    action: "admin.plan_created",
                    resourceType: "plan",
                    resourceId: plan.id,
                    req: req,
                });
                res.status(201).json({ plan: plan });
                return [2 /*return*/];
        }
    });
}); });
// ── PUT /api/admin/plans/:planId/features ─────────────────────────────────────
var setPlanFeaturesSchema = zod_1.z.object({
    features: zod_1.z.array(zod_1.z.object({
        featureName: zod_1.z.string().min(1),
        limitValue: zod_1.z.number().int().nullable().optional(),
        limitPeriod: zod_1.z.string().nullable().optional(),
    })),
});
router.put("/plans/:planId/features", (0, validate_1.validate)(setPlanFeaturesSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var planId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                planId = String(req.params["planId"]);
                return [4 /*yield*/, (0, admin_service_1.adminSetPlanFeatures)(planId, req.body.features)];
            case 1:
                _a.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    actorType: "admin",
                    action: "admin.plan_updated",
                    resourceType: "plan",
                    resourceId: planId,
                    req: req,
                });
                res.json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/admin/feature-flags ─────────────────────────────────────────────
var featureFlagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    enabledGlobally: zod_1.z.boolean().optional(),
    rolloutPercentage: zod_1.z.number().int().min(0).max(100).optional(),
    description: zod_1.z.string().optional(),
});
router.post("/feature-flags", (0, validate_1.validate)(featureFlagSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, admin_service_1.adminSetFeatureFlag)(req.body.name, req.body)];
            case 1:
                _a.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    actorType: "admin",
                    action: "admin.feature_flag_toggled",
                    metadata: req.body,
                    req: req,
                });
                res.json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
router.get("/audit-logs", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var logs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, admin_service_1.adminGetAuditLogs)({
                    actorId: req.query["actorId"],
                    action: req.query["action"],
                    limit: req.query["limit"] ? Number(req.query["limit"]) : 50,
                    offset: req.query["offset"] ? Number(req.query["offset"]) : 0,
                })];
            case 1:
                logs = _a.sent();
                res.json({ logs: logs });
                return [2 /*return*/];
        }
    });
}); });
// ── GET /api/admin/webhook-events ─────────────────────────────────────────────
router.get("/webhook-events", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var events;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, admin_service_1.adminGetWebhookEvents)(req.query["limit"] ? Number(req.query["limit"]) : 50)];
            case 1:
                events = _a.sent();
                res.json({ events: events });
                return [2 /*return*/];
        }
    });
}); });
exports.default = router;
