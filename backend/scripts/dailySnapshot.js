import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Ipo from "../models/Ipo.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { rankIpos, explainScoreChange } from "../utils/ranking.js";
import { collectAndScoreForIpo } from "../services/socialAggregator.js";

// This is the "what changed today?" engine (spec section 61): once a day,
// snapshot every IPO's ranking, refresh its social sentiment from live
// sources, and notify every user whose watchlist rank moved meaningfully.
//
// Run manually with `npm run daily-job`, or schedule it:
//   - cron (recommended for a real deployment): add a crontab entry like
//     `0 7 * * * cd /path/to/backend && node scripts/dailySnapshot.js`
//   - or set RUN_CRON=true in .env to have server.js run it in-process on
//     a schedule via node-cron (simpler for local dev, less robust for prod)

async function snapshotRankingsAndNotify() {
  const all = await Ipo.find({});
  const ranked = rankIpos(all.map((i) => i.toObject()));

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  for (const entry of ranked) {
    const ipo = all.find((i) => i._id.toString() === entry.ipo._id.toString());
    const existingIdx = ipo.rankingHistory.findIndex((s) => new Date(s.date) >= today0);
    const snapshot = { date: new Date(), score: entry.score, rank: entry.rank, breakdown: entry.breakdown };

    const previous = ipo.rankingHistory[ipo.rankingHistory.length - 1];

    if (existingIdx >= 0) ipo.rankingHistory[existingIdx] = snapshot;
    else ipo.rankingHistory.push(snapshot);
    await ipo.save();

    // Notify watchers if the rank moved by 3+ (default alert threshold, spec section 38)
    if (previous && Math.abs((previous.rank || 0) - entry.rank) >= 3) {
      const explain = explainScoreChange(previous, snapshot);
      const direction = entry.rank < previous.rank ? "up" : "down";
      const usersWatching = await mongoose.model("Watchlist").find({ ipo: ipo._id }).distinct("user");
      for (const userId of usersWatching) {
        await Notification.create({
          user: userId,
          ipo: ipo._id,
          priority: "important",
          category: "rank_change",
          message: `${ipo.name} rank moved ${direction} (#${previous.rank} → #${entry.rank}). Top driver: ${explain?.contributions?.[0]?.label || "n/a"}`,
        });
      }
    }
  }

  console.log(`Ranking snapshots taken for ${ranked.length} IPOs`);
}

async function collectSocialForAll() {
  const all = await Ipo.find({});
  for (const ipo of all) {
    try {
      const result = await collectAndScoreForIpo(ipo);
      console.log(`Social collected for ${ipo.name}: ${result.newMentions} new mentions, score ${result.overallScore}`);
    } catch (err) {
      console.warn(`Social collection failed for ${ipo.name}:`, err.message);
    }
    // Be polite to free/public endpoints (esp. Reddit's rate limit) — small delay between IPOs.
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function runDailyJob() {
  await snapshotRankingsAndNotify();
  await collectSocialForAll();
  console.log("Daily job complete:", new Date().toISOString());
}

// Allow running directly: `node scripts/dailySnapshot.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  connectDB()
    .then(runDailyJob)
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
