import { Router } from "express";
import Ipo from "../models/Ipo.js";
import { rankIpos, computeScore, explainScoreChange } from "../utils/ranking.js";
import { defaultConfidenceMap } from "../utils/dataConfidence.js";

const router = Router();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// GET /api/ipos - list, with optional ?q= search, ?status= and ?board= filter
router.get("/", async (req, res) => {
  const { q, status, board } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (board && board !== "all") filter.board = board;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { slug: { $regex: q, $options: "i" } },
      { board: { $regex: q, $options: "i" } },
    ];
  }
  const ipos = await Ipo.find(filter).sort({ "dates.openDate": -1 }).lean();
  res.json({ ipos });
});

// POST /api/ipos/sync - trigger live data ingestion from Indian market feeds
router.post("/sync", async (req, res) => {
  try {
    const { ingestLiveIpos } = await import("../services/ipoIngestion.js");
    const result = await ingestLiveIpos();
    res.json({ ok: true, result });
  } catch (err) {
    console.error("Live sync failed:", err);
    res.status(500).json({ error: "Failed to sync live data", detail: err.message });
  }
});

// GET /api/ipos/today - dynamic "Today" categories (spec sections 3-5)
router.get("/today", async (req, res) => {
  const today0 = startOfDay();
  const today1 = endOfDay();
  const tomorrow0 = startOfDay(addDays(today0, 1));
  const tomorrow1 = endOfDay(addDays(today0, 1));

  const all = await Ipo.find({}).lean();

  const between = (date, start, end) => date && new Date(date) >= start && new Date(date) <= end;

  const categories = {
    openingToday: all.filter((i) => between(i.dates?.openDate, today0, today1)),
    openNow: all.filter(
      (i) => i.dates?.openDate && i.dates?.closeDate && new Date(i.dates.openDate) <= today1 && new Date(i.dates.closeDate) >= today0
    ),
    closingToday: all.filter((i) => between(i.dates?.closeDate, today0, today1)),
    closingTomorrow: all.filter((i) => between(i.dates?.closeDate, tomorrow0, tomorrow1)),
    listingToday: all.filter((i) => between(i.dates?.listingDate, today0, today1)),
    listingTomorrow: all.filter((i) => between(i.dates?.listingDate, tomorrow0, tomorrow1)),
    allotmentToday: all.filter((i) => between(i.dates?.allotmentDate, today0, today1)),
    allotmentTomorrow: all.filter((i) => between(i.dates?.allotmentDate, tomorrow0, tomorrow1)),
    startingTomorrow: all.filter((i) => between(i.dates?.openDate, tomorrow0, tomorrow1)),
    newlyAnnounced: all.filter((i) => i.createdAt && new Date(i.createdAt) >= addDays(today0, -3)),
  };

  const counts = Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length]));

  res.json({ counts, categories });
});

// GET /api/ipos/:slug
router.get("/:slug", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug }).lean();
  if (!ipo) return res.status(404).json({ error: "IPO not found" });
  res.json({ ipo, dataConfidence: defaultConfidenceMap() });
});

// POST /api/ipos/:slug/ranking-snapshot - compute current score and append
// to rankingHistory (spec section 25). Safe to call repeatedly; if a
// snapshot was already taken today it updates that one instead of piling up
// duplicates.
router.post("/:slug/ranking-snapshot", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug });
  if (!ipo) return res.status(404).json({ error: "IPO not found" });

  const all = await Ipo.find({}).lean();
  const ranked = rankIpos(all);
  const mine = ranked.find((r) => r.ipo._id.toString() === ipo._id.toString());
  if (!mine) return res.status(500).json({ error: "Could not compute ranking" });

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  const existingTodayIdx = ipo.rankingHistory.findIndex((s) => new Date(s.date) >= today0);
  const snapshot = { date: new Date(), score: mine.score, rank: mine.rank, breakdown: mine.breakdown };

  if (existingTodayIdx >= 0) {
    ipo.rankingHistory[existingTodayIdx] = snapshot;
  } else {
    ipo.rankingHistory.push(snapshot);
  }
  await ipo.save();

  res.status(201).json({ snapshot });
});

// GET /api/ipos/:slug/ranking-explain - "why did rank change?" (spec section 26)
// Diffs the two most recent ranking snapshots.
router.get("/:slug/ranking-explain", async (req, res) => {
  const ipo = await Ipo.findOne({ slug: req.params.slug }).lean();
  if (!ipo) return res.status(404).json({ error: "IPO not found" });

  const history = [...(ipo.rankingHistory || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (history.length < 2) {
    return res.json({
      explain: null,
      message: "Not enough ranking history yet — take at least two snapshots (POST /ranking-snapshot on different days) to see an explanation.",
      history,
    });
  }

  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  const explain = explainScoreChange(previous, current);
  res.json({ explain, history });
});

// GET /api/ipos/:slug/ranking-explain?weights=... (section 26: "why did rank change?")
router.get("/rank/all", async (req, res) => {
  const all = await Ipo.find({}).lean();
  const ranked = rankIpos(all);
  res.json({
    ranked: ranked.map((r) => ({
      id: r.ipo._id,
      name: r.ipo.name,
      slug: r.ipo.slug,
      score: r.score,
      rank: r.rank,
      breakdown: r.breakdown,
    })),
  });
});

export default router;
