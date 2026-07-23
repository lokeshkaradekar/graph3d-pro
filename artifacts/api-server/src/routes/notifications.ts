import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "../services/notification.service";

const router = Router();

router.use(authenticate, requireAuth);

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(req.user!.id),
    getUnreadCount(req.user!.id),
  ]);
  res.json({ notifications, unreadCount });
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  const ok = await markNotificationRead(req.params["id"]!, req.user!.id);
  if (!ok) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json({ ok: true });
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post("/read-all", async (req, res) => {
  await markAllNotificationsRead(req.user!.id);
  res.json({ ok: true });
});

export default router;
