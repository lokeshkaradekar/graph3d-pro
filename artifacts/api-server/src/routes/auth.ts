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
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { authLimiter } from "../middlewares/rate-limit";
import { validate } from "../middlewares/validate";
import {
  findUserByEmail,
  createUser,
  verifyPassword,
  isAccountLocked,
  registerFailedLogin,
  clearFailedLogins,
  isValidEmail,
  validatePassword,
  normalizeEmail,
  createEmailVerificationToken,
  verifyEmail,
  initiatePasswordReset,
  resetPassword,
  softDeleteUser,
} from "../services/user.service";
import {
  createSession,
  destroySession,
  destroyAllUserSessions,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromRequest,
} from "../services/session.service";
import { createFreeSubscription } from "../services/subscription.service";
import { sendVerificationEmail } from "../lib/email";
import {
  audit,
  auditAuth,
  type AuditAction,
} from "../services/audit.service";

const router = Router();

// Validation schemas
const signupSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().optional(),
  // Honeypot — must be absent or empty
  website: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

// Generic error to prevent email enumeration in all login flows
const GENERIC_LOGIN_ERROR = "Invalid email or password.";

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post(
  "/signup",
  authLimiter,
  validate(signupSchema),
  async (req, res) => {
    // Honeypot check — bots fill hidden fields; real users never see them
    if (req.body.website) {
      // Return fake success so bots don't know we rejected them
      res.status(201).json({ ok: true });
      return;
    }

    const { email, password, displayName } = req.body;

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    // Check for duplicate
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    try {
      const { user } = await createUser({ email, password, displayName });

      // Create free subscription immediately
      await createFreeSubscription(user.id);

      const { token, expiresAt, session } = await createSession(user.id, req, false);
      setSessionCookie(res, token, false, expiresAt);

      auditAuth("auth.signup", { id: user.id }, req);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (err) {
      req.log.error({ err }, "signup error");
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  },
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  async (req, res) => {
    const { email, password, rememberMe } = req.body;

    if (!isValidEmail(email) || typeof password !== "string" || !password) {
      res.status(401).json({ error: GENERIC_LOGIN_ERROR });
      return;
    }

    try {
      const user = await findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: GENERIC_LOGIN_ERROR });
        return;
      }

      if (isAccountLocked(user)) {
        res.status(423).json({
          error: "Account temporarily locked due to too many failed attempts. Try again later.",
        });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash ?? "");
      if (!valid) {
        await registerFailedLogin(user.id);
        auditAuth("auth.login_failed", { id: user.id }, req);
        res.status(401).json({ error: GENERIC_LOGIN_ERROR });
        return;
      }

      await clearFailedLogins(user.id);

      const { token, expiresAt } = await createSession(user.id, req, rememberMe ?? false);
      setSessionCookie(res, token, rememberMe ?? false, expiresAt);

      auditAuth("auth.login_success", { id: user.id }, req);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (err) {
      req.log.error({ err }, "login error");
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  },
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", authenticate, async (req, res) => {
  const token = getTokenFromRequest(req);
  try {
    await destroySession(token);
  } catch (err) {
    req.log.error({ err }, "logout error");
    // Fall through — clear cookie regardless
  }

  auditAuth("auth.logout", req.user, req);
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
});

// ── POST /api/auth/logout-all (invalidate all sessions) ──────────────────────
router.post("/logout-all", authenticate, requireAuth, async (req, res) => {
  try {
    await destroyAllUserSessions(req.user!.id);
    clearSessionCookie(res);
    auditAuth("auth.logout_all", req.user, req);
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "logout-all error");
    res.status(500).json({ error: "Something went wrong." });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ user: null });
    return;
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
});

// ── POST /api/auth/verify-email ───────────────────────────────────────────────
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  async (req, res) => {
    const { token } = req.body;
    const result = await verifyEmail(token);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    audit({ action: "auth.email_verified", actorType: "user" });
    res.status(200).json({ ok: true });
  },
);

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post(
  "/resend-verification",
  authLimiter,
  authenticate,
  requireAuth,
  async (req, res) => {
    if (req.user!.isVerified) {
      res.status(400).json({ error: "Your email is already verified." });
      return;
    }
    try {
      const token = await createEmailVerificationToken(req.user!.id);
      await sendVerificationEmail(req.user!.email, token);
      auditAuth("auth.email_verification_resent", req.user, req);
      res.status(200).json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "resend-verification error");
      res.status(500).json({ error: "Failed to send verification email." });
    }
  },
);

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  async (req, res) => {
    // Always return 200 to prevent email enumeration
    try {
      await initiatePasswordReset(req.body.email, req);
    } catch (err) {
      req.log.error({ err }, "forgot-password error");
    }
    audit({ action: "auth.password_reset_requested", actorType: "user" });
    res.status(200).json({
      ok: true,
      message: "If an account exists with that email, you will receive a reset link.",
    });
  },
);

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  async (req, res) => {
    const { token, password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const result = await resetPassword(token, password);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Invalidate all sessions after password reset (security: force re-login)
    if (result.userId) {
      await destroyAllUserSessions(result.userId);
      audit({
        actorId: result.userId,
        action: "auth.password_changed",
        resourceType: "user",
        resourceId: result.userId,
        req,
      });
    }

    res.status(200).json({ ok: true });
  },
);

export default router;
