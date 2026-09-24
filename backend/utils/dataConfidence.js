// Spec sections 47-48: every metric should show how much to trust it, and
// conflicting values from multiple sources should surface rather than be
// silently averaged away.

// Static confidence tiers per metric family. These are defaults for a
// single-source setup; once you wire multiple GMP/subscription providers,
// compute this per-IPO instead (see detectGmpConflict below for the pattern).
export const CONFIDENCE_LEVELS = {
  official: "Official",
  verifiedThirdParty: "Verified third-party",
  community: "Community",
  unofficial: "Unofficial",
  estimated: "Estimated",
};

export function defaultConfidenceMap() {
  return {
    priceDetails: CONFIDENCE_LEVELS.official,
    dates: CONFIDENCE_LEVELS.official,
    subscription: CONFIDENCE_LEVELS.official,
    fundamentals: CONFIDENCE_LEVELS.verifiedThirdParty,
    valuation: CONFIDENCE_LEVELS.verifiedThirdParty,
    gmp: CONFIDENCE_LEVELS.unofficial,
    social: CONFIDENCE_LEVELS.community,
    news: CONFIDENCE_LEVELS.verifiedThirdParty,
  };
}

/**
 * Given a set of GMP points from the same day but potentially different
 * sources, flag a conflict if they disagree by more than a threshold, and
 * report the median as the value to display (spec section 48).
 */
export function detectGmpConflict(pointsForDay, thresholdPct = 15) {
  if (!pointsForDay || pointsForDay.length < 2) return null;

  const values = pointsForDay.map((p) => p.value).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

  const min = values[0];
  const max = values[values.length - 1];
  const spreadPct = median ? ((max - min) / median) * 100 : 0;

  if (spreadPct <= thresholdPct) return null;

  return {
    conflict: true,
    values: pointsForDay.map((p) => ({ value: p.value, source: p.source })),
    displayedValue: median,
    reason: "Median of available sources",
    spreadPct: Math.round(spreadPct),
  };
}
