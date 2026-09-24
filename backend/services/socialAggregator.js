import Ipo from "../models/Ipo.js";
import SocialPost from "../models/SocialPost.js";
import { collectReddit } from "./collectors/reddit.js";
import { collectNews } from "./collectors/newsRss.js";
import { collectYoutube } from "./collectors/youtube.js";
import { collectX, collectTelegram, collectInstagram } from "./collectors/stubs.js";
import { scoreSentiment, classifyPost, weightForPost } from "../utils/sentiment.js";

const SOURCES = ["reddit", "x", "youtube", "news", "instagram", "telegram"];

// Scale a -1..1 sentiment score to a 0..100 "score out of 100" the rest of
// the UI expects (spec sections 19, 22, 44 all show 0-100 scores per source).
function to100(score) {
  return Math.round(((score + 1) / 2) * 100);
}

/**
 * Collect fresh mentions for one IPO from every available source, classify
 * and store them, then recompute the aggregate social.* fields and append
 * one point to social.sentimentHistory. Safe to call repeatedly — posts are
 * deduped by URL, and a source that errors or has no API key just
 * contributes zero posts rather than failing the whole run.
 */
export async function collectAndScoreForIpo(ipo) {
  const [reddit, news, youtube, x, telegram, instagram] = await Promise.all([
    collectReddit(ipo.name).catch(() => []),
    collectNews(ipo.name).catch(() => []),
    collectYoutube(ipo.name).catch(() => []),
    collectX(ipo.name).catch(() => []),
    collectTelegram(ipo.name).catch(() => []),
    collectInstagram(ipo.name).catch(() => []),
  ]);

  const rawPosts = [...reddit, ...news, ...youtube, ...x, ...telegram, ...instagram];

  let savedCount = 0;
  for (const raw of rawPosts) {
    const { score, sentiment } = scoreSentiment(raw.text);
    const { category, sourceQuality } = classifyPost(raw.text, raw.engagement);

    try {
      // upsert on (ipo, url) so re-running collection doesn't duplicate
      await SocialPost.findOneAndUpdate(
        { ipo: ipo._id, url: raw.url },
        {
          ipo: ipo._id,
          source: raw.source,
          sourceName: raw.sourceName,
          author: raw.author,
          text: raw.text,
          url: raw.url,
          publishedAt: raw.publishedAt,
          engagement: raw.engagement,
          sentiment,
          sentimentScore: score,
          category,
          sourceQuality,
          collectedAt: new Date(),
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      savedCount += 1;
    } catch (err) {
      // duplicate key races etc. — skip, not fatal
    }
  }

  return recomputeSocialAggregate(ipo._id, { newMentions: savedCount });
}

/**
 * Recompute social.bySource / overallScore / positive-neutral-negative split
 * from stored SocialPost documents (last 7 days, recency+engagement weighted),
 * and append a sentimentHistory point. Call this after collection, or on its
 * own if you just want to re-score without re-fetching.
 */
export async function recomputeSocialAggregate(ipoId, { newMentions = 0 } = {}) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const posts = await SocialPost.find({ ipo: ipoId, publishedAt: { $gte: since } }).lean();

  const bySource = {};
  for (const src of SOURCES) {
    const srcPosts = posts.filter((p) => p.source === src && p.sourceQuality !== "spam" && p.sourceQuality !== "promotional");
    if (srcPosts.length === 0) {
      bySource[src] = null; // no data collected for this source
      continue;
    }
    let weightedSum = 0;
    let weightTotal = 0;
    for (const p of srcPosts) {
      const w = weightForPost(p);
      weightedSum += p.sentimentScore * w;
      weightTotal += w;
    }
    const avg = weightTotal > 0 ? weightedSum / weightTotal : 0;
    bySource[src] = to100(avg);
  }

  const usable = posts.filter((p) => p.sourceQuality !== "spam" && p.sourceQuality !== "promotional");
  const positivePct = usable.length ? Math.round((usable.filter((p) => p.sentiment === "positive").length / usable.length) * 100) : 0;
  const negativePct = usable.length ? Math.round((usable.filter((p) => p.sentiment === "negative").length / usable.length) * 100) : 0;
  const neutralPct = Math.max(0, 100 - positivePct - negativePct);

  const validScores = Object.values(bySource).filter((v) => v !== null);
  const overallScore = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 50;

  // Mention volume change vs the previous 7-day window
  const prevSince = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const prevCount = await SocialPost.countDocuments({ ipo: ipoId, publishedAt: { $gte: prevSince, $lt: since } });
  const mentionVolumeChangePct = prevCount > 0 ? Math.round(((usable.length - prevCount) / prevCount) * 100) : usable.length > 0 ? 100 : 0;

  const historyPoint = { date: new Date(), overallScore, bySource, mentionCount: usable.length };

  await Ipo.findByIdAndUpdate(ipoId, {
    $set: {
      "social.overallScore": overallScore,
      "social.bySource": bySource,
      "social.mentionVolumeChangePct": mentionVolumeChangePct,
      "social.positivePct": positivePct,
      "social.neutralPct": neutralPct,
      "social.negativePct": negativePct,
      "social.lastUpdated": new Date(),
    },
    $push: { "social.sentimentHistory": historyPoint },
  });

  return { overallScore, bySource, positivePct, neutralPct, negativePct, mentionVolumeChangePct, newMentions, postsConsidered: usable.length };
}
