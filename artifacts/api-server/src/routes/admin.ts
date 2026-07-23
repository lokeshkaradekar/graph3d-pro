import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/require-admin";
import { validate, validateQuery } from "../middlewares/validate";
import {
  adminListUsers,
  adminCreatePlan,
  adminSetPlanFeatures,
  adminSetFeatureFlag,
  adminGetDashboardStats,
  adminGetAuditLogs,
  adminGetWebhookEvents,
} from "../services/admin.service";
import { grantFeature, revokeFeature } from "../services/feature.service";
import { audit } from "../services/audit.service";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { plansTable } from "@workspace/db";

const router = Router();

// All admin routes require admin role
router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  const stats = await adminGetDashboardStats();
  res.json(stats);
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
const listUsersQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

router.get("/users", validateQuery(listUsersQuery), async (req, res) => {
  const { search, limit, offset } = req.query as unknown as z.infer<typeof listUsersQuery>;
  const result = await adminListUsers(search, limit, offset);
  res.json(result);
});

// ── POST /api/admin/users/:userId/grant-feature ───────────────────────────────
const grantFeatureSchema = z.object({
  featureName: z.string().min(1),
  limitValue: z.number().int().min(0).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.post(
  "/users/:userId/grant-feature",
  validate(grantFeatureSchema),
  async (req, res) => {
    const userId = String(req.params["userId"]);
    const { featureName, limitValue, expiresAt } = req.body;
    await grantFeature(userId, featureName, {
      grantedBy: "admin",
      grantedByRef: req.user!.id,
      limitValue: limitValue ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    audit({
      actorId: req.user!.id,
      actorType: "admin",
      action: "feature.granted",
      resourceType: "user",
      resourceId: userId,
      metadata: { featureName, limitValue, expiresAt },
      req,
    });
    res.json({ ok: true });
  },
);

// ── POST /api/admin/users/:userId/revoke-feature ──────────────────────────────
const revokeFeatureSchema = z.object({ featureName: z.string().min(1) });

router.post(
  "/users/:userId/revoke-feature",
  validate(revokeFeatureSchema),
  async (req, res) => {
    const userId = String(req.params["userId"]);
    await revokeFeature(userId, req.body.featureName);
    audit({
      actorId: req.user!.id,
      actorType: "admin",
      action: "feature.revoked",
      resourceType: "user",
      resourceId: userId,
      metadata: { featureName: req.body.featureName },
      req,
    });
    res.json({ ok: true });
  },
);

// ── GET /api/admin/plans ──────────────────────────────────────────────────────
router.get("/plans", async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.sortOrder);
  res.json({ plans });
});

// ── POST /api/admin/plans ─────────────────────────────────────────────────────
const createPlanSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  description: z.string().optional(),
  priceMonthlycents: z.number().int().min(0),
  priceYearlyCents: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  sortOrder: z.number().int().optional(),
});

router.post("/plans", validate(createPlanSchema), async (req, res) => {
  const plan = await adminCreatePlan(req.body);
  audit({
    actorId: req.user!.id,
    actorType: "admin",
    action: "admin.plan_created",
    resourceType: "plan",
    resourceId: plan.id,
    req,
  });
  res.status(201).json({ plan });
});

// ── PUT /api/admin/plans/:planId/features ─────────────────────────────────────
const setPlanFeaturesSchema = z.object({
  features: z.array(
    z.object({
      featureName: z.string().min(1),
      limitValue: z.number().int().nullable().optional(),
      limitPeriod: z.string().nullable().optional(),
    }),
  ),
});

router.put(
  "/plans/:planId/features",
  validate(setPlanFeaturesSchema),
  async (req, res) => {
    const planId = String(req.params["planId"]);
    await adminSetPlanFeatures(planId, req.body.features);
    audit({
      actorId: req.user!.id,
      actorType: "admin",
      action: "admin.plan_updated",
      resourceType: "plan",
      resourceId: planId,
      req,
    });
    res.json({ ok: true });
  },
);

// ── POST /api/admin/feature-flags ─────────────────────────────────────────────
const featureFlagSchema = z.object({
  name: z.string().min(1),
  enabledGlobally: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  description: z.string().optional(),
});

router.post("/feature-flags", validate(featureFlagSchema), async (req, res) => {
  await adminSetFeatureFlag(req.body.name, req.body);
  audit({
    actorId: req.user!.id,
    actorType: "admin",
    action: "admin.feature_flag_toggled",
    metadata: req.body,
    req,
  });
  res.json({ ok: true });
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
router.get("/audit-logs", async (req, res) => {
  const logs = await adminGetAuditLogs({
    actorId: req.query["actorId"] as string | undefined,
    action: req.query["action"] as string | undefined,
    limit: req.query["limit"] ? Number(req.query["limit"]) : 50,
    offset: req.query["offset"] ? Number(req.query["offset"]) : 0,
  });
  res.json({ logs });
});

// ── GET /api/admin/webhook-events ─────────────────────────────────────────────
router.get("/webhook-events", async (req, res) => {
  const events = await adminGetWebhookEvents(
    req.query["limit"] ? Number(req.query["limit"]) : 50,
  );
  res.json({ events });
});

export default router;
