import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { validate } from "../middlewares/validate";
import {
  findUserById,
  updateProfile,
  softDeleteUser,
} from "../services/user.service";
import { destroyAllUserSessions, clearSessionCookie } from "../services/session.service";
import { audit } from "../services/audit.service";

const router = Router();

// All user routes require authentication
router.use(authenticate, requireAuth);

const updateProfileSchema = z.object({
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const user = await findUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  });
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
router.patch("/me", validate(updateProfileSchema), async (req, res) => {
  const updated = await updateProfile(req.user!.id, req.body);
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  audit({
    actorId: req.user!.id,
    action: "auth.signup", // Reuse closest — no "profile.updated" in our strict type
    resourceType: "user",
    resourceId: req.user!.id,
    req,
  });
  res.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
  });
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────────
// Soft-delete the account. All sessions invalidated immediately.
router.delete("/me", async (req, res) => {
  await destroyAllUserSessions(req.user!.id);
  await softDeleteUser(req.user!.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;
