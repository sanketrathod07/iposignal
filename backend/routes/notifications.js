import { Router } from "express";
import requireAuth from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = Router();
router.use(requireAuth);

// GET /api/notifications - unified updates feed (spec section 32-37)
router.get("/", async (req, res) => {
  const items = await Notification.find({ user: req.userId }).populate("ipo").sort({ createdAt: -1 }).limit(100).lean();
  const unreadCount = items.filter((i) => !i.read).length;

  const user = await User.findById(req.userId);
  const sinceLastVisit = items.filter((i) => new Date(i.createdAt) > new Date(user.lastVisitedAt || 0));

  res.json({ items, unreadCount, sinceLastVisit: sinceLastVisit.length });
});

// PATCH /api/notifications/read-all
router.patch("/read-all", async (req, res) => {
  await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { $set: { read: true } }, { new: true });
  if (!n) return res.status(404).json({ error: "Notification not found" });
  res.json({ notification: n });
});

export default router;
