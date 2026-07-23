/**
 * Rate limiting middleware using express-rate-limit.
 *
 * Uses an in-memory store which is appropriate for a single-process server.
 * For multi-instance deployments, swap the store for a Redis store:
 *   npm install rate-limit-redis
 *   store: new RedisStore({ ... })
 */
import rateLimit from "express-rate-limit";
import type { Request } from "express";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_WEBHOOK_MAX,
} from "../lib/constants";

/** General API rate limiter — applied to all routes */
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again." },
  skip: (req: Request) => req.method === "OPTIONS",
});

/** Strict limiter for auth endpoints (login, signup, password reset) */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

/** Relaxed limiter for webhook endpoints (provider retries legitimately) */
// keyGenerator left at default (req.ip) — express-rate-limit handles IPv6 normalization.
export const webhookLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_WEBHOOK_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many webhook requests." },
});
