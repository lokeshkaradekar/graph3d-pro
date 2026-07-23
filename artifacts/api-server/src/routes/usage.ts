import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { getUserUsage } from "../services/usage.service";
import { getUserFeatures } from "../services/feature.service";

const router = Router();

router.use(authenticate, requireAuth);

// ── GET /api/usage/me — current user's usage stats ────────────────────────────
router.get("/me", async (req, res) => {
  const [usage, features] = await Promise.all([
    getUserUsage(req.user!.id),
    getUserFeatures(req.user!.id),
  ]);

  // Build a usage summary with limits from plan
  const summary = features
    .filter((f) => f.limitValue !== null)
    .map((f) => {
      const usageRow = usage.find(
        (u) =>
          u.metric === f.featureName &&
          u.period === (f.limitPeriod === "yearly" ? new Date().getUTCFullYear().toString() : `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`),
      );
      return {
        feature: f.featureName,
        used: usageRow?.value ?? 0,
        limit: f.limitValue,
        period: f.limitPeriod,
      };
    });

  res.json({ usage, summary });
});

export default router;
