// Lightweight, dependency-free sentiment + category classification.
// This is intentionally simple (word-list scoring) so the pipeline works
// out of the box with no API keys or ML model downloads. Swap in a real
// model (e.g. a hosted classifier) behind the same function signatures
// when you're ready to go further.

const POSITIVE_WORDS = [
  "strong", "bullish", "solid", "good", "great", "excellent", "healthy",
  "robust", "attractive", "undervalued", "oversubscribed", "surge", "jump",
  "rally", "gain", "profit", "growth", "beat", "outperform", "positive",
  "recommend", "apply", "subscribe", "buy", "promising", "impressive",
  "upgrade", "momentum", "confident", "solid fundamentals", "cheap valuation",
];

const NEGATIVE_WORDS = [
  "weak", "bearish", "overvalued", "risky", "risk", "concern", "concerned",
  "worried", "avoid", "skip", "loss", "decline", "drop", "fall", "crash",
  "poor", "bad", "disappointing", "underwhelming", "overpriced", "expensive",
  "debt", "litigation", "fraud", "scam", "warning", "caution", "doubtful",
  "red flag", "downgrade", "sell", "negative", "trouble", "delay",
];

const QUESTION_MARKERS = ["?", "should i", "is it worth", "what do you think", "anyone applying", "worth applying"];
const RUMOUR_MARKERS = ["heard that", "rumou", "unconfirmed", "allegedly", "sources say", "might be", "could be delayed"];
const PROMO_MARKERS = ["guaranteed returns", "100% profit", "join telegram", "dm me", "sure shot", "guaranteed allotment", "click here", "limited offer"];
const NEWS_MARKERS = ["announced", "filed", "sebi", "reported", "according to", "press release", "regulatory"];

function countMatches(text, words) {
  const lower = text.toLowerCase();
  return words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
}

/**
 * Score sentiment from -1 (very negative) to 1 (very positive) based on
 * keyword density, then bucket into positive/neutral/negative.
 */
export function scoreSentiment(text) {
  const pos = countMatches(text, POSITIVE_WORDS);
  const neg = countMatches(text, NEGATIVE_WORDS);
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / total;

  let sentiment = "neutral";
  if (score > 0.15) sentiment = "positive";
  else if (score < -0.15) sentiment = "negative";

  return { score: Math.round(score * 100) / 100, sentiment };
}

/**
 * Classify a post into a discussion category and a source-quality tier.
 * Spam/promotional detection runs first since it should override everything else.
 */
export function classifyPost(text, engagement = {}) {
  const lower = text.toLowerCase();

  if (countMatches(lower, PROMO_MARKERS) > 0) {
    return { category: "promotional", sourceQuality: "promotional" };
  }
  if (countMatches(lower, RUMOUR_MARKERS) > 0) {
    return { category: "rumour", sourceQuality: "speculation" };
  }
  if (countMatches(lower, QUESTION_MARKERS) > 0) {
    return { category: "questions", sourceQuality: "normal" };
  }
  if (countMatches(lower, NEWS_MARKERS) > 0) {
    return { category: "news", sourceQuality: "high-information" };
  }

  const { sentiment } = scoreSentiment(text);
  const hasEngagement = (engagement.upvotesOrLikes || 0) + (engagement.comments || 0) > 20;
  const category = sentiment === "positive" ? "positive" : sentiment === "negative" ? "negative" : "analysis";
  const sourceQuality = hasEngagement ? "high-information" : "normal";

  return { category, sourceQuality };
}

/**
 * Weight a post's contribution to the aggregate score by recency and
 * engagement, so one loud post doesn't count the same as one nobody read.
 * Returns a multiplier, typically 0.3 - 3.0.
 */
export function weightForPost(post) {
  const ageHours = (Date.now() - new Date(post.publishedAt).getTime()) / 36e5;
  const recencyWeight = ageHours <= 24 ? 1.5 : ageHours <= 72 ? 1.0 : ageHours <= 168 ? 0.6 : 0.3;

  const engagementRaw = (post.engagement?.upvotesOrLikes || 0) + (post.engagement?.comments || 0) * 2;
  const engagementWeight = 1 + Math.min(2, Math.log10(engagementRaw + 1));

  const qualityWeight =
    post.sourceQuality === "spam" || post.sourceQuality === "promotional"
      ? 0.1
      : post.sourceQuality === "speculation"
      ? 0.5
      : post.sourceQuality === "high-information"
      ? 1.3
      : 1.0;

  return recencyWeight * engagementWeight * qualityWeight;
}
