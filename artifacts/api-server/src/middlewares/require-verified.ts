import type { Request, Response, NextFunction } from "express";

/**
 * Rejects users whose email is not verified.
 * Must run AFTER requireAuth.
 *
 * Apply to sensitive actions (payments, API key creation, etc.)
 * where we need to know the user actually controls their email.
 */
export function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!req.user.isVerified) {
    res.status(403).json({
      error: "Please verify your email address to access this feature.",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }
  next();
}
