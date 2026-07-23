import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import {
  hasFeature,
  getUserFeatures,
} from "../services/feature.service";

const router = Router();

router.use(authenticate, requireAuth);

// ── GET /api/features/me — all features for the current user ──────────────────
router.get("/me", async (req, res) => {
  const features = await getUserFeatures(req.user!.id);
  res.json({ features });
});

// ── GET /api/features/check/:feature — check a single feature ─────────────────
router.get("/check/:feature", async (req, res) => {
  const featureName = req.params["feature"];
  if (!featureName) {
    res.status(400).json({ error: "Feature name is required." });
    return;
  }
  const result = await hasFeature(req.user!.id, featureName);
  res.json({
    feature: featureName,
    allowed: result.allowed,
    reason: result.reason,
    remaining: result.remaining,
  });
});

export default router;
