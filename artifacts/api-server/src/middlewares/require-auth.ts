import type { Request, Response, NextFunction } from "express";

/**
 * Rejects unauthenticated requests with 401.
 * Must run AFTER authenticate middleware.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}
