import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAuth } from "../middlewares/require-auth.js";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "../services/notification.service.js";

const router = Router();

router.use(authenticate, requireAuth);

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(req.user!.id),
    getUnreadCount(req.user!.id),
  ]);
  res.json({ notifications, unreadCount });
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch("/:id/read", async (req: Request, res: Response) => {
  const ok = await markNotificationRead(String(req.params["id"]!), req.user!.id);
  if (!ok) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json({ ok: true });
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post("/read-all", async (req: Request, res: Response) => {
  await markAllNotificationsRead(req.user!.id);
  res.json({ ok: true });
});

export default router;
