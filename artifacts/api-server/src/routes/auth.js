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
 * Auth routes — signup, login, logout, me, verify email, password reset.
 *
 * Security properties:
 * - Login uses generic error message (prevents email enumeration)
 * - Session tokens stored as SHA-256 hashes in DB
 * - Honeypot field on signup (anti-bot)
 * - Brute-force lockout (5 attempts → 15 min lock)
 * - HttpOnly + SameSite=Lax cookies (XSS + CSRF protection)
 * - Password reset and email verification are single-use tokens
 */
var express_1 = require("express");
var zod_1 = require("zod");
var authenticate_1 = require("../middlewares/authenticate");
var require_auth_1 = require("../middlewares/require-auth");
var rate_limit_1 = require("../middlewares/rate-limit");
var validate_1 = require("../middlewares/validate");
var user_service_1 = require("../services/user.service");
var session_service_1 = require("../services/session.service");
var subscription_service_1 = require("../services/subscription.service");
var email_1 = require("../lib/email");
var audit_service_1 = require("../services/audit.service");
var router = (0, express_1.Router)();
// Validation schemas
var signupSchema = zod_1.z.object({
    email: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
    displayName: zod_1.z.string().optional(),
    // Honeypot — must be absent or empty
    website: zod_1.z.string().optional(),
});
var loginSchema = zod_1.z.object({
    email: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
    rememberMe: zod_1.z.boolean().optional(),
});
var verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
var forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().min(1),
});
var resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
// Generic error to prevent email enumeration in all login flows
var GENERIC_LOGIN_ERROR = "Invalid email or password.";
// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/signup", rate_limit_1.authLimiter, (0, validate_1.validate)(signupSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password, displayName, passwordError, existing, user, _b, token, expiresAt, session, err_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                // Honeypot check — bots fill hidden fields; real users never see them
                if (req.body.website) {
                    // Return fake success so bots don't know we rejected them
                    res.status(201).json({ ok: true });
                    return [2 /*return*/];
                }
                _a = req.body, email = _a.email, password = _a.password, displayName = _a.displayName;
                if (!(0, user_service_1.isValidEmail)(email)) {
                    res.status(400).json({ error: "Please enter a valid email address." });
                    return [2 /*return*/];
                }
                passwordError = (0, user_service_1.validatePassword)(password);
                if (passwordError) {
                    res.status(400).json({ error: passwordError });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, user_service_1.findUserByEmail)(email)];
            case 1:
                existing = _c.sent();
                if (existing) {
                    res.status(409).json({ error: "An account with that email already exists." });
                    return [2 /*return*/];
                }
                _c.label = 2;
            case 2:
                _c.trys.push([2, 6, , 7]);
                return [4 /*yield*/, (0, user_service_1.createUser)({ email: email, password: password, displayName: displayName })];
            case 3:
                user = (_c.sent()).user;
                // Create free subscription immediately
                return [4 /*yield*/, (0, subscription_service_1.createFreeSubscription)(user.id)];
            case 4:
                // Create free subscription immediately
                _c.sent();
                return [4 /*yield*/, (0, session_service_1.createSession)(user.id, req, false)];
            case 5:
                _b = _c.sent(), token = _b.token, expiresAt = _b.expiresAt, session = _b.session;
                (0, session_service_1.setSessionCookie)(res, token, false, expiresAt);
                (0, audit_service_1.auditAuth)("auth.signup", { id: user.id }, req);
                res.status(201).json({
                    user: {
                        id: user.id,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        isVerified: user.isVerified,
                    },
                });
                return [3 /*break*/, 7];
            case 6:
                err_1 = _c.sent();
                req.log.error({ err: err_1 }, "signup error");
                res.status(500).json({ error: "Something went wrong. Please try again." });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", rate_limit_1.authLimiter, (0, validate_1.validate)(loginSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password, rememberMe, user, valid, _b, token, expiresAt, err_2;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = req.body, email = _a.email, password = _a.password, rememberMe = _a.rememberMe;
                if (!(0, user_service_1.isValidEmail)(email) || typeof password !== "string" || !password) {
                    res.status(401).json({ error: GENERIC_LOGIN_ERROR });
                    return [2 /*return*/];
                }
                _d.label = 1;
            case 1:
                _d.trys.push([1, 8, , 9]);
                return [4 /*yield*/, (0, user_service_1.findUserByEmail)(email)];
            case 2:
                user = _d.sent();
                if (!user) {
                    res.status(401).json({ error: GENERIC_LOGIN_ERROR });
                    return [2 /*return*/];
                }
                if ((0, user_service_1.isAccountLocked)(user)) {
                    res.status(423).json({
                        error: "Account temporarily locked due to too many failed attempts. Try again later.",
                    });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, user_service_1.verifyPassword)(password, (_c = user.passwordHash) !== null && _c !== void 0 ? _c : "")];
            case 3:
                valid = _d.sent();
                if (!!valid) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, user_service_1.registerFailedLogin)(user.id)];
            case 4:
                _d.sent();
                (0, audit_service_1.auditAuth)("auth.login_failed", { id: user.id }, req);
                res.status(401).json({ error: GENERIC_LOGIN_ERROR });
                return [2 /*return*/];
            case 5: return [4 /*yield*/, (0, user_service_1.clearFailedLogins)(user.id)];
            case 6:
                _d.sent();
                return [4 /*yield*/, (0, session_service_1.createSession)(user.id, req, rememberMe !== null && rememberMe !== void 0 ? rememberMe : false)];
            case 7:
                _b = _d.sent(), token = _b.token, expiresAt = _b.expiresAt;
                (0, session_service_1.setSessionCookie)(res, token, rememberMe !== null && rememberMe !== void 0 ? rememberMe : false, expiresAt);
                (0, audit_service_1.auditAuth)("auth.login_success", { id: user.id }, req);
                res.status(200).json({
                    user: {
                        id: user.id,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        isVerified: user.isVerified,
                    },
                });
                return [3 /*break*/, 9];
            case 8:
                err_2 = _d.sent();
                req.log.error({ err: err_2 }, "login error");
                res.status(500).json({ error: "Something went wrong. Please try again." });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", authenticate_1.authenticate, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var token, err_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = (0, session_service_1.getTokenFromRequest)(req);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, session_service_1.destroySession)(token)];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                err_3 = _a.sent();
                req.log.error({ err: err_3 }, "logout error");
                return [3 /*break*/, 4];
            case 4:
                (0, audit_service_1.auditAuth)("auth.logout", req.user, req);
                (0, session_service_1.clearSessionCookie)(res);
                res.status(200).json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/logout-all (invalidate all sessions) ──────────────────────
router.post("/logout-all", authenticate_1.authenticate, require_auth_1.requireAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var err_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, session_service_1.destroyAllUserSessions)(req.user.id)];
            case 1:
                _a.sent();
                (0, session_service_1.clearSessionCookie)(res);
                (0, audit_service_1.auditAuth)("auth.logout_all", req.user, req);
                res.status(200).json({ ok: true });
                return [3 /*break*/, 3];
            case 2:
                err_4 = _a.sent();
                req.log.error({ err: err_4 }, "logout-all error");
                res.status(500).json({ error: "Something went wrong." });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate_1.authenticate, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (!req.user) {
            res.status(401).json({ user: null });
            return [2 /*return*/];
        }
        res.status(200).json({
            user: {
                id: req.user.id,
                email: req.user.email,
                displayName: req.user.displayName,
                avatarUrl: req.user.avatarUrl,
                role: req.user.role,
                isVerified: req.user.isVerified,
            },
        });
        return [2 /*return*/];
    });
}); });
// ── POST /api/auth/verify-email ───────────────────────────────────────────────
router.post("/verify-email", (0, validate_1.validate)(verifyEmailSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var token, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = req.body.token;
                return [4 /*yield*/, (0, user_service_1.verifyEmail)(token)];
            case 1:
                result = _a.sent();
                if (!result.ok) {
                    res.status(400).json({ error: result.error });
                    return [2 /*return*/];
                }
                (0, audit_service_1.audit)({ action: "auth.email_verified", actorType: "user" });
                res.status(200).json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post("/resend-verification", rate_limit_1.authLimiter, authenticate_1.authenticate, require_auth_1.requireAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var token, err_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (req.user.isVerified) {
                    res.status(400).json({ error: "Your email is already verified." });
                    return [2 /*return*/];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, (0, user_service_1.createEmailVerificationToken)(req.user.id)];
            case 2:
                token = _a.sent();
                return [4 /*yield*/, (0, email_1.sendVerificationEmail)(req.user.email, token)];
            case 3:
                _a.sent();
                (0, audit_service_1.auditAuth)("auth.email_verification_resent", req.user, req);
                res.status(200).json({ ok: true });
                return [3 /*break*/, 5];
            case 4:
                err_5 = _a.sent();
                req.log.error({ err: err_5 }, "resend-verification error");
                res.status(500).json({ error: "Failed to send verification email." });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post("/forgot-password", rate_limit_1.authLimiter, (0, validate_1.validate)(forgotPasswordSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var err_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, user_service_1.initiatePasswordReset)(req.body.email, req)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                err_6 = _a.sent();
                req.log.error({ err: err_6 }, "forgot-password error");
                return [3 /*break*/, 3];
            case 3:
                (0, audit_service_1.audit)({ action: "auth.password_reset_requested", actorType: "user" });
                res.status(200).json({
                    ok: true,
                    message: "If an account exists with that email, you will receive a reset link.",
                });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", rate_limit_1.authLimiter, (0, validate_1.validate)(resetPasswordSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, token, password, passwordError, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, token = _a.token, password = _a.password;
                passwordError = (0, user_service_1.validatePassword)(password);
                if (passwordError) {
                    res.status(400).json({ error: passwordError });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, user_service_1.resetPassword)(token, password)];
            case 1:
                result = _b.sent();
                if (!result.ok) {
                    res.status(400).json({ error: result.error });
                    return [2 /*return*/];
                }
                if (!result.userId) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, session_service_1.destroyAllUserSessions)(result.userId)];
            case 2:
                _b.sent();
                (0, audit_service_1.audit)({
                    actorId: result.userId,
                    action: "auth.password_changed",
                    resourceType: "user",
                    resourceId: result.userId,
                    req: req,
                });
                _b.label = 3;
            case 3:
                res.status(200).json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
exports.default = router;
