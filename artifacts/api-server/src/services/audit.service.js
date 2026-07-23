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
exports.audit = audit;
exports.auditAuth = auditAuth;
exports.auditBilling = auditBilling;
exports.auditWebhook = auditWebhook;
/**
 * Audit Service — immutable log of every sensitive action.
 *
 * Design principles:
 * - Fire-and-forget: audit logging never blocks the request
 * - Never fails silently in prod: errors are logged but don't propagate
 * - Structured: action names follow '<service>.<event>' convention
 * - Redacted: no passwords, tokens, raw PII beyond user IDs
 */
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var logger_1 = require("../lib/logger");
/**
 * Log an audit event. Non-blocking — never awaited in the request path.
 * Call as: audit({ ... }) — no await
 */
function audit(params) {
    var _this = this;
    setImmediate(function () { return __awaiter(_this, void 0, void 0, function () {
        var req, ipAddress, userAgent, err_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 2, , 3]);
                    req = params.req;
                    ipAddress = req
                        ? getIpFromRequest(req)
                        : null;
                    userAgent = (_a = req === null || req === void 0 ? void 0 : req.headers["user-agent"]) !== null && _a !== void 0 ? _a : null;
                    return [4 /*yield*/, db_1.db.insert(db_2.auditLogsTable).values({
                            actorId: (_b = params.actorId) !== null && _b !== void 0 ? _b : null,
                            actorType: (_c = params.actorType) !== null && _c !== void 0 ? _c : "user",
                            action: params.action,
                            resourceType: (_d = params.resourceType) !== null && _d !== void 0 ? _d : null,
                            resourceId: (_e = params.resourceId) !== null && _e !== void 0 ? _e : null,
                            metadata: (_f = params.metadata) !== null && _f !== void 0 ? _f : null,
                            ipAddress: ipAddress,
                            userAgent: userAgent,
                        })];
                case 1:
                    _g.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _g.sent();
                    // Audit log failure must never crash the application
                    logger_1.logger.error({ err: err_1, action: params.action }, "Failed to write audit log");
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
function getIpFromRequest(req) {
    var _a, _b, _c;
    var forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string")
        return forwarded.split(",")[0].trim();
    if (Array.isArray(forwarded))
        return (_a = forwarded[0]) !== null && _a !== void 0 ? _a : null;
    return (_c = (_b = req.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) !== null && _c !== void 0 ? _c : null;
}
/** Helper: log auth events with user context */
function auditAuth(action, user, req, metadata) {
    var _a;
    audit({
        actorId: (_a = user === null || user === void 0 ? void 0 : user.id) !== null && _a !== void 0 ? _a : null,
        actorType: "user",
        action: action,
        resourceType: "user",
        resourceId: user === null || user === void 0 ? void 0 : user.id,
        metadata: metadata,
        req: req,
    });
}
/** Helper: log subscription/billing events */
function auditBilling(action, userId, metadata) {
    audit({
        actorId: userId,
        actorType: "user",
        action: action,
        resourceType: "subscription",
        metadata: metadata,
    });
}
/** Helper: log webhook events */
function auditWebhook(action, metadata) {
    audit({
        actorType: "webhook",
        action: action,
        resourceType: "payment_event",
        metadata: metadata,
    });
}
