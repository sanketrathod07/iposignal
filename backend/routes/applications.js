import { Router } from "express";
import requireAuth from "../middleware/auth.js";
import Application from "../models/Application.js";
import Ipo from "../models/Ipo.js";
import Notification from "../models/Notification.js";

const router = Router();
router.use(requireAuth);

// GET /api/applications
router.get("/", async (req, res) => {
  const apps = await Application.find({ user: req.userId }).populate("ipo").sort({ createdAt: -1 }).lean();
  const totalBlocked = apps
    .filter((a) => a.stage !== "Refund" && a.stage !== "Shares Credited" && a.stage !== "Listed")
    .reduce((sum, a) => sum + (a.amountBlocked || 0), 0);
  res.json({ applications: apps, capitalBlocked: totalBlocked });
});

// POST /api/applications { ipoId, lots, amountBlocked }
router.post("/", async (req, res) => {
  const { ipoId, lots, amountBlocked } = req.body;
  const ipo = await Ipo.findById(ipoId);
  if (!ipo) return res.status(404).json({ error: "IPO not found" });

  const app = await Application.create({
    user: req.userId,
    ipo: ipoId,
    lots: lots || 1,
    amountBlocked,
  });

  await Notification.create({
    user: req.userId,
    ipo: ipoId,
    priority: "important",
    category: "application",
    message: `Application recorded for ${ipo.name}: ${lots || 1} lot(s)`,
  });

  res.status(201).json({ application: app });
});

// PATCH /api/applications/:id { stage, allotmentResult, refundAmount }
router.patch("/:id", async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, user: req.userId }).populate("ipo");
  if (!app) return res.status(404).json({ error: "Application not found" });

  const { stage, allotmentResult, refundAmount } = req.body;
  if (stage) app.stage = stage;
  if (allotmentResult) app.allotmentResult = allotmentResult;
  if (refundAmount !== undefined) app.refundAmount = refundAmount;
  await app.save();

  if (stage || allotmentResult) {
    await Notification.create({
      user: req.userId,
      ipo: app.ipo?._id,
      priority: "critical",
      category: "allotment",
      message: `${app.ipo?.name}: ${allotmentResult ? "Allotment result - " + allotmentResult : "Stage updated to " + stage}`,
    });
  }

  res.json({ application: app });
});

export default router;
