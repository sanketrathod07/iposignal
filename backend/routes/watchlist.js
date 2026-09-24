import { Router } from "express";
import requireAuth from "../middleware/auth.js";
import Watchlist from "../models/Watchlist.js";
import Ipo from "../models/Ipo.js";
import Notification from "../models/Notification.js";
import { rankIpos, DEFAULT_WEIGHTS } from "../utils/ranking.js";

const router = Router();
router.use(requireAuth);

// GET /api/watchlist - user's watchlist, ranked
router.get("/", async (req, res) => {
  const entries = await Watchlist.find({ user: req.userId }).populate("ipo").lean();
  const ipos = entries.map((e) => e.ipo).filter(Boolean);

  const weights = { ...DEFAULT_WEIGHTS };
  if (req.query.model) {
    // allow simple single-dimension ranking, e.g. ?model=gmp
    for (const key of Object.keys(weights)) weights[key] = 0;
    if (weights[req.query.model] !== undefined) weights[req.query.model] = 100;
    else Object.assign(weights, DEFAULT_WEIGHTS);
  }

  const ranked = rankIpos(ipos, weights);

  const byIpoId = Object.fromEntries(entries.map((e) => [e.ipo?._id?.toString(), e]));

  const result = ranked.map((r) => {
    const entry = byIpoId[r.ipo._id.toString()];
    return {
      watchlistId: entry._id,
      status: entry.status,
      rank: r.rank,
      score: r.score,
      breakdown: r.breakdown,
      ipo: r.ipo,
    };
  });

  res.json({ watchlist: result });
});

// POST /api/watchlist { ipoId }
router.post("/", async (req, res) => {
  const { ipoId } = req.body;
  const ipo = await Ipo.findById(ipoId);
  if (!ipo) return res.status(404).json({ error: "IPO not found" });
  try {
    const entry = await Watchlist.create({ user: req.userId, ipo: ipoId });
    await Notification.create({
      user: req.userId,
      ipo: ipoId,
      priority: "normal",
      category: "system",
      message: `${ipo.name} added to your watchlist`,
    });
    res.status(201).json({ entry });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Already in watchlist" });
    res.status(500).json({ error: "Could not add to watchlist", detail: err.message });
  }
});

// PATCH /api/watchlist/:id { status, notes, alertRules }
router.patch("/:id", async (req, res) => {
  const entry = await Watchlist.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) return res.status(404).json({ error: "Watchlist entry not found" });

  const { status, notes, alertRules } = req.body;
  if (status) entry.status = status;
  if (notes !== undefined) entry.notes = notes;
  if (alertRules) entry.alertRules = { ...entry.alertRules.toObject(), ...alertRules };
  await entry.save();
  res.json({ entry });
});

// DELETE /api/watchlist/:id
router.delete("/:id", async (req, res) => {
  const entry = await Watchlist.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!entry) return res.status(404).json({ error: "Watchlist entry not found" });
  res.json({ ok: true });
});

export default router;
