import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { requireVerified } from "../middlewares/require-verified";
import { validate } from "../middlewares/validate";
import {
  getPublicPlans,
  getActiveSubscription,
  getSubscriptionHistory,
  cancelSubscription,
} from "../services/subscription.service";
import { audit } from "../services/audit.service";

const router = Router();

// ── GET /api/subscriptions/plans (public) ────────────────────────────────────
router.get("/plans", async (_req, res) => {
  const plans = await getPublicPlans();
  res.json({ plans });
});

// All remaining routes require auth
router.use(authenticate, requireAuth);

// ── GET /api/subscriptions/me ─────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const [active, history] = await Promise.all([
    getActiveSubscription(req.user!.id),
    getSubscriptionHistory(req.user!.id),
  ]);
  res.json({ active, history });
});

// ── POST /api/subscriptions/cancel ───────────────────────────────────────────
const cancelSchema = z.object({
  subscriptionId: z.string().uuid(),
  immediate: z.boolean().optional().default(false),
});

router.post(
  "/cancel",
  requireVerified,
  validate(cancelSchema),
  async (req, res) => {
    const { subscriptionId, immediate } = req.body;

    await cancelSubscription(req.user!.id, subscriptionId, !immediate);

    audit({
      actorId: req.user!.id,
      action: "subscription.canceled",
      resourceType: "subscription",
      resourceId: subscriptionId,
      metadata: { immediate },
      req,
    });

    res.json({ ok: true });
  },
);

// ── GET /api/subscriptions/history ────────────────────────────────────────────
router.get("/history", async (req, res) => {
  const history = await getSubscriptionHistory(req.user!.id);
  res.json({ history });
});

export default router;
