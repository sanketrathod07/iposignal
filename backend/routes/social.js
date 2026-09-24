import { Router } from "express";
import Ipo from "../models/Ipo.js";
import SocialPost from "../models/SocialPost.js";
import { collectAndScoreForIpo, recomputeSocialAggregate } from "../services/socialAggregator.js";

const router = Router();

// POST /api/ipos/:slug/social/collect - fetch fresh Reddit/News/YouTube
// mentions, score them, and refresh the IPO's aggregate social fields.
// This hits live public endpoints, so don't call it in a tight loop —
// scheduled collection (see scripts/dailySnapshot.js) is the intended path.
router.post("/:slug/social/collect", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug });
  if (!ipo) return res.status(404).json({ error: "IPO not found" });

  try {
    const result = await collectAndScoreForIpo(ipo);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: "Social collection failed", detail: err.message });
  }
});

// POST /api/ipos/:slug/social/rescore - recompute aggregates from already-
// stored posts, without hitting external sources again. Cheap, safe to call often.
router.post("/:slug/social/rescore", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug });
  if (!ipo) return res.status(404).json({ error: "IPO not found" });
  const result = await recomputeSocialAggregate(ipo._id);
  res.json({ ok: true, result });
});

// GET /api/ipos/:slug/social/posts?category=&source= - discussion feed with
// filters (spec section 21).
router.get("/:slug/social/posts", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug }).lean();
  if (!ipo) return res.status(404).json({ error: "IPO not found" });

  const filter = { ipo: ipo._id };
  if (req.query.category && req.query.category !== "all") filter.category = req.query.category;
  if (req.query.source && req.query.source !== "all") filter.source = req.query.source;

  const posts = await SocialPost.find(filter).sort({ publishedAt: -1 }).limit(50).lean();
  res.json({ posts });
});

// GET /api/ipos/:slug/social/trend - sentiment history for the trend chart (spec section 20)
router.get("/:slug/social/trend", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug }).lean();
  if (!ipo) return res.status(404).json({ error: "IPO not found" });
  res.json({ trend: ipo.social?.sentimentHistory || [] });
});

export default router;
