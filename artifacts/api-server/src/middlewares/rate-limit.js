"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookLimiter = exports.authLimiter = exports.generalLimiter = void 0;
/**
 * Rate limiting middleware using express-rate-limit.
 *
 * Uses an in-memory store which is appropriate for a single-process server.
 * For multi-instance deployments, swap the store for a Redis store:
 *   npm install rate-limit-redis
 *   store: new RedisStore({ ... })
 */
var express_rate_limit_1 = require("express-rate-limit");
var constants_1 = require("../lib/constants");
/** General API rate limiter — applied to all routes */
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.RATE_LIMIT_WINDOW_MS,
    max: constants_1.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again." },
    skip: function (req) { return req.method === "OPTIONS"; },
});
/** Strict limiter for auth endpoints (login, signup, password reset) */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.RATE_LIMIT_WINDOW_MS,
    max: constants_1.RATE_LIMIT_AUTH_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many attempts. Please wait 15 minutes and try again.",
    },
});
/** Relaxed limiter for webhook endpoints (provider retries legitimately) */
// keyGenerator left at default (req.ip) — express-rate-limit handles IPv6 normalization.
exports.webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.RATE_LIMIT_WINDOW_MS,
    max: constants_1.RATE_LIMIT_WEBHOOK_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many webhook requests." },
});
