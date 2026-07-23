import type { Request, Response, NextFunction } from "express";
import { hasFeature } from "../services/feature.service";

/**
 * Factory: creates a middleware that rejects users who don't have a feature.
 *
 * Usage:
 *   router.post('/export', requireAuth, requireFeature('high_resolution_export'), handler)
 *
 * This is the enforcement point. The feature check hits the database —
 * never trusts a cached or frontend-supplied plan name.
 */
export function requireFeature(featureName: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const result = await hasFeature(req.user.id, featureName);
    if (!result.allowed) {
      res.status(403).json({
        error: result.reason ?? "Your plan does not include this feature.",
        feature: featureName,
        upgrade: true,
      });
      return;
    }

    next();
  };
}
