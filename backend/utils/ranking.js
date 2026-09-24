// Ranking engine: combines independent dimensions into a single score
// using a configurable weight model. Each dimension is normalized to 0-100
// before weighting so no single raw metric (e.g. GMP in rupees) dominates.

function clamp(n, min = 0, max = 100) {
  if (n === undefined || n === null || Number.isNaN(n)) return 50; // neutral default
  return Math.max(min, Math.min(max, n));
}

// GMP score: percentage of GMP over the lower price band, capped at 100.
function gmpScore(ipo) {
  const gmp = ipo.gmp?.current;
  const priceMin = ipo.priceBandMin;
  if (!gmp || !priceMin) return 50;
  const pct = (gmp / priceMin) * 100;
  return clamp(pct * 2); // scale so ~50% GMP premium -> 100 score
}

// GMP trend score: based on recent history slope (last 3 points vs prior).
function gmpTrendScore(ipo) {
  const history = ipo.gmp?.history || [];
  if (history.length < 2) return 50;
  const recent = history.slice(-3);
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  if (!first) return 50;
  const changePct = ((last - first) / first) * 100;
  return clamp(50 + changePct); // rising -> above 50, falling -> below
}

// Subscription score: overall subscription multiple on the latest day.
function subscriptionScore(ipo) {
  const history = ipo.subscription?.history || [];
  if (!history.length) return 50;
  const latest = history[history.length - 1];
  const overall = latest.overall || 0;
  return clamp(overall * 5); // 20x subscription -> 100 score
}

function socialSentimentScore(ipo) {
  return clamp(ipo.social?.overallScore);
}

function fundamentalsScore(ipo) {
  return clamp(ipo.fundamentals?.score);
}

// Valuation score: cheaper vs peers = higher score.
function valuationScore(ipo) {
  const { peIpo, pePeerMedian } = ipo.valuation || {};
  if (!peIpo || !pePeerMedian) return 50;
  const premiumPct = ((peIpo - pePeerMedian) / pePeerMedian) * 100;
  return clamp(50 - premiumPct); // trading above peers -> lower score
}

// IPO structure score: higher fresh-issue proportion = higher score
// (fresh capital goes to the company; OFS goes to selling shareholders).
function ipoStructureScore(ipo) {
  const fresh = ipo.freshIssueCr || 0;
  const ofs = ipo.ofsCr || 0;
  const total = fresh + ofs;
  if (!total) return 50;
  return clamp((fresh / total) * 100);
}

// Risk score placeholder: derived from debt/equity + customer concentration
// flag until a dedicated risk model (Phase 3) exists. Higher = lower risk.
function riskScore(ipo) {
  const de = ipo.fundamentals?.debtToEquity;
  if (de === undefined || de === null) return 50;
  return clamp(100 - de * 25);
}

export const DEFAULT_WEIGHTS = {
  fundamentals: 25,
  valuation: 15,
  gmp: 15,
  gmpTrend: 5,
  subscription: 15,
  socialSentiment: 10,
  risk: 10,
  ipoStructure: 5,
};

export function computeBreakdown(ipo) {
  return {
    fundamentals: fundamentalsScore(ipo),
    valuation: valuationScore(ipo),
    gmp: gmpScore(ipo),
    gmpTrend: gmpTrendScore(ipo),
    subscription: subscriptionScore(ipo),
    socialSentiment: socialSentimentScore(ipo),
    risk: riskScore(ipo),
    ipoStructure: ipoStructureScore(ipo),
  };
}

export function computeScore(ipo, weights = DEFAULT_WEIGHTS) {
  const breakdown = computeBreakdown(ipo);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  let score = 0;
  for (const key of Object.keys(weights)) {
    score += (breakdown[key] ?? 50) * (weights[key] / totalWeight);
  }
  return { score: Math.round(score * 10) / 10, breakdown };
}

// Rank a list of IPOs by computed score, descending, returning
// { ipo, score, breakdown, rank }.
export function rankIpos(ipos, weights = DEFAULT_WEIGHTS) {
  const scored = ipos.map((ipo) => {
    const { score, breakdown } = computeScore(ipo, weights);
    return { ipo, score, breakdown };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

const DIMENSION_LABELS = {
  fundamentals: "Fundamentals",
  valuation: "Valuation",
  gmp: "GMP",
  gmpTrend: "GMP trend",
  subscription: "Subscription",
  socialSentiment: "Social sentiment",
  risk: "Risk",
  ipoStructure: "IPO structure",
};

/**
 * Spec section 26 — "Why did rank change?" Diffs two ranking snapshots
 * (each shaped like { score, rank, breakdown }) and returns a sorted list
 * of per-dimension contributions to the score delta, largest first, plus
 * the overall score/rank change.
 */
export function explainScoreChange(previousSnapshot, currentSnapshot, weights = DEFAULT_WEIGHTS) {
  if (!previousSnapshot || !currentSnapshot) return null;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const contributions = Object.keys(weights).map((key) => {
    const prevVal = previousSnapshot.breakdown?.[key] ?? 50;
    const currVal = currentSnapshot.breakdown?.[key] ?? 50;
    const rawDelta = currVal - prevVal;
    const weightedDelta = Math.round(rawDelta * (weights[key] / totalWeight) * 10) / 10;
    return {
      dimension: key,
      label: DIMENSION_LABELS[key] || key,
      rawDelta: Math.round(rawDelta * 10) / 10,
      weightedDelta,
    };
  });

  contributions.sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta));

  return {
    scoreChange: Math.round((currentSnapshot.score - previousSnapshot.score) * 10) / 10,
    rankChange: previousSnapshot.rank && currentSnapshot.rank ? previousSnapshot.rank - currentSnapshot.rank : null,
    previous: { score: previousSnapshot.score, rank: previousSnapshot.rank, date: previousSnapshot.date },
    current: { score: currentSnapshot.score, rank: currentSnapshot.rank, date: currentSnapshot.date },
    contributions,
  };
}
