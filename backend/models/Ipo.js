import mongoose from "mongoose";

// GMP time-series point
const gmpPointSchema = new mongoose.Schema(
  {
    value: Number,
    date: { type: Date, default: Date.now },
    source: { type: String, default: "GMP Provider" },
  },
  { _id: false }
);

// One day's subscription snapshot across categories
const subscriptionPointSchema = new mongoose.Schema(
  {
    day: Number, // 1, 2, 3...
    date: { type: Date, default: Date.now },
    qib: Number,
    nii: Number,
    retail: Number,
    employee: Number,
    shareholder: Number,
    overall: Number,
  },
  { _id: false }
);

const rankingSnapshotSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    score: Number,
    rank: Number,
    breakdown: {
      fundamentals: Number,
      valuation: Number,
      gmp: Number,
      gmpTrend: Number,
      subscription: Number,
      socialSentiment: Number,
      risk: Number,
      ipoStructure: Number,
    },
  },
  { _id: false }
);

const ipoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    board: { type: String, enum: ["Mainboard", "SME"], default: "Mainboard" },
    exchanges: [{ type: String, enum: ["NSE", "BSE"] }],

    // Pricing / structure
    priceBandMin: Number,
    priceBandMax: Number,
    lotSize: Number,
    issueSizeCr: Number,
    freshIssueCr: Number,
    ofsCr: Number,
    useOfProceeds: [String], // e.g. ["Debt repayment", "Capex"]

    // Lifecycle dates
    dates: {
      drhpFiled: Date,
      rhpFiled: Date,
      anchorDate: Date,
      openDate: Date,
      closeDate: Date,
      allotmentDate: Date,
      refundDate: Date,
      creditDate: Date,
      listingDate: Date,
    },

    // Fundamentals (relatively static, one-time research)
    fundamentals: {
      score: { type: Number, min: 0, max: 100 },
      lastCalculated: Date,
      revenueGrowthPct: Number,
      profitGrowthPct: Number,
      ebitdaGrowthPct: Number,
      eps: Number,
      roe: Number,
      roce: Number,
      debtToEquity: Number,
      operatingCashFlowCr: Number,
      freeCashFlowCr: Number,
      marginsPct: Number,
      promoterHoldingPct: Number,
      customerConcentrationNote: String,
      industry: String,
    },

    // Valuation
    valuation: {
      peIpo: Number,
      pePeerMedian: Number,
      peIndustryMedian: Number,
      pbIpo: Number,
      evEbitda: Number,
      evSales: Number,
      marketCapCr: Number,
    },

    // GMP
    gmp: {
      current: Number,
      history: [gmpPointSchema],
    },

    // Subscription
    subscription: {
      history: [subscriptionPointSchema], // day-wise
    },

    // Social sentiment (Phase 2: populated by services/socialAggregator.js)
    social: {
      overallScore: Number,
      bySource: {
        reddit: Number,
        x: Number,
        youtube: Number,
        news: Number,
        instagram: Number,
        telegram: Number,
      },
      mentionVolumeChangePct: Number,
      positivePct: Number,
      neutralPct: Number,
      negativePct: Number,
      lastUpdated: Date,
      // Daily sentiment trend, e.g. [{date, overallScore, bySource, mentionCount}]
      sentimentHistory: [
        {
          date: { type: Date, default: Date.now },
          overallScore: Number,
          bySource: {
            reddit: Number,
            x: Number,
            youtube: Number,
            news: Number,
            instagram: Number,
            telegram: Number,
          },
          mentionCount: Number,
        },
      ],
    },

    news: [
      {
        headline: String,
        source: String,
        url: String,
        category: String,
        publishedAt: Date,
      },
    ],

    // Ranking snapshots (global "overall" model, computed server-side)
    rankingHistory: [rankingSnapshotSchema],

    status: {
      type: String,
      enum: ["upcoming", "open", "closed", "allotment", "listed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

ipoSchema.index({ name: "text" });

export default mongoose.model("Ipo", ipoSchema);
