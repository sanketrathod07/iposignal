import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Ipo from "../models/Ipo.js";

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function gmpHistory(base, days = 10, volatility = 6) {
  const hist = [];
  let v = base;
  for (let i = days; i >= 0; i--) {
    v = Math.max(0, v + (Math.random() * volatility - volatility / 2));
    hist.push({ value: Math.round(v), date: daysFromNow(-i), source: "GMP Provider" });
  }
  return hist;
}

function subscriptionHistory(finalMultiple) {
  const day1 = +(finalMultiple * 0.1).toFixed(2);
  const day2 = +(finalMultiple * 0.4).toFixed(2);
  const day3 = finalMultiple;
  return [
    { day: 1, date: daysFromNow(-2), qib: day1 * 0.5, nii: day1 * 1.2, retail: day1 * 1.5, overall: day1 },
    { day: 2, date: daysFromNow(-1), qib: day2 * 0.8, nii: day2 * 1.3, retail: day2 * 1.1, overall: day2 },
    { day: 3, date: daysFromNow(0), qib: day3 * 1.4, nii: day3 * 1.1, retail: day3 * 0.9, overall: day3 },
  ];
}

const raw = [
  {
    name: "ABC Technologies",
    slug: "abc-technologies",
    board: "Mainboard",
    exchanges: ["NSE", "BSE"],
    priceBandMin: 420,
    priceBandMax: 440,
    lotSize: 34,
    issueSizeCr: 850,
    freshIssueCr: 600,
    ofsCr: 250,
    useOfProceeds: ["Debt repayment", "Capex", "General corporate purposes"],
    dates: {
      drhpFiled: daysFromNow(-60),
      rhpFiled: daysFromNow(-20),
      anchorDate: daysFromNow(-1),
      openDate: daysFromNow(0),
      closeDate: daysFromNow(2),
      allotmentDate: daysFromNow(5),
      refundDate: daysFromNow(6),
      creditDate: daysFromNow(6),
      listingDate: daysFromNow(8),
    },
    fundamentals: {
      score: 82,
      lastCalculated: daysFromNow(-5),
      revenueGrowthPct: 28,
      profitGrowthPct: 34,
      ebitdaGrowthPct: 30,
      eps: 12.4,
      roe: 19.2,
      roce: 22.1,
      debtToEquity: 0.4,
      operatingCashFlowCr: 210,
      freeCashFlowCr: 140,
      marginsPct: 18.5,
      promoterHoldingPct: 62,
      customerConcentrationNote: "Top 5 customers ~ 31% of revenue",
      industry: "IT Services",
    },
    valuation: { peIpo: 38.2, pePeerMedian: 31.7, peIndustryMedian: 33.1, pbIpo: 6.1, evEbitda: 24.5, evSales: 5.2, marketCapCr: 4200 },
    gmp: { current: 82, history: gmpHistory(60) },
    subscription: { history: subscriptionHistory(12.42) },
    social: {
      overallScore: 71,
      bySource: { reddit: 68, x: 74, youtube: 81, news: 72, instagram: 65, telegram: 69 },
      mentionVolumeChangePct: 38,
      positivePct: 61,
      neutralPct: 24,
      negativePct: 15,
      lastUpdated: daysFromNow(0),
    },
    news: [
      { headline: "ABC Technologies files RHP ahead of IPO launch", source: "Business Standard", category: "Regulatory", publishedAt: daysFromNow(-20) },
      { headline: "QIB portion sees strong early demand", source: "Moneycontrol", category: "Subscription", publishedAt: daysFromNow(0) },
    ],
    status: "open",
  },
  {
    name: "XYZ Industries",
    slug: "xyz-industries",
    board: "Mainboard",
    exchanges: ["NSE", "BSE"],
    priceBandMin: 180,
    priceBandMax: 190,
    lotSize: 78,
    issueSizeCr: 1200,
    freshIssueCr: 400,
    ofsCr: 800,
    useOfProceeds: ["Debt repayment"],
    dates: {
      drhpFiled: daysFromNow(-90),
      rhpFiled: daysFromNow(-30),
      anchorDate: daysFromNow(-3),
      openDate: daysFromNow(-2),
      closeDate: daysFromNow(1),
      allotmentDate: daysFromNow(4),
      refundDate: daysFromNow(5),
      creditDate: daysFromNow(5),
      listingDate: daysFromNow(7),
    },
    fundamentals: {
      score: 76,
      lastCalculated: daysFromNow(-10),
      revenueGrowthPct: 15,
      profitGrowthPct: 11,
      ebitdaGrowthPct: 13,
      eps: 8.1,
      roe: 14.5,
      roce: 16.8,
      debtToEquity: 0.9,
      operatingCashFlowCr: 150,
      freeCashFlowCr: 60,
      marginsPct: 12.1,
      promoterHoldingPct: 55,
      customerConcentrationNote: "Diversified customer base",
      industry: "Industrial Manufacturing",
    },
    valuation: { peIpo: 22.1, pePeerMedian: 24.3, peIndustryMedian: 23.0, pbIpo: 3.4, evEbitda: 14.2, evSales: 2.1, marketCapCr: 3100 },
    gmp: { current: 17, history: gmpHistory(28, 10, 8) },
    subscription: { history: subscriptionHistory(8.2) },
    social: {
      overallScore: 64,
      bySource: { reddit: 60, x: 58, youtube: 70, news: 66, instagram: 55, telegram: 61 },
      mentionVolumeChangePct: 12,
      positivePct: 48,
      neutralPct: 33,
      negativePct: 19,
      lastUpdated: daysFromNow(0),
    },
    news: [
      { headline: "Large OFS component draws investor scrutiny", source: "Economic Times", category: "Analysis", publishedAt: daysFromNow(-2) },
    ],
    status: "open",
  },
  {
    name: "PQR Renewables",
    slug: "pqr-renewables",
    board: "Mainboard",
    exchanges: ["NSE", "BSE"],
    priceBandMin: 310,
    priceBandMax: 325,
    lotSize: 46,
    issueSizeCr: 640,
    freshIssueCr: 640,
    ofsCr: 0,
    useOfProceeds: ["Capex", "Working capital"],
    dates: {
      drhpFiled: daysFromNow(-45),
      rhpFiled: daysFromNow(-15),
      anchorDate: daysFromNow(2),
      openDate: daysFromNow(3),
      closeDate: daysFromNow(5),
      allotmentDate: daysFromNow(8),
      refundDate: daysFromNow(9),
      creditDate: daysFromNow(9),
      listingDate: daysFromNow(11),
    },
    fundamentals: {
      score: 69,
      lastCalculated: daysFromNow(-2),
      revenueGrowthPct: 41,
      profitGrowthPct: 9,
      ebitdaGrowthPct: 22,
      eps: 5.6,
      roe: 11.2,
      roce: 13.4,
      debtToEquity: 1.6,
      operatingCashFlowCr: 40,
      freeCashFlowCr: -20,
      marginsPct: 9.8,
      promoterHoldingPct: 71,
      customerConcentrationNote: "Two state utilities ~ 48% of revenue",
      industry: "Renewable Energy",
    },
    valuation: { peIpo: 45.6, pePeerMedian: 29.4, peIndustryMedian: 31.0, pbIpo: 7.8, evEbitda: 28.1, evSales: 6.4, marketCapCr: 2600 },
    gmp: { current: 68, history: gmpHistory(50, 12, 10) },
    subscription: { history: [] },
    social: {
      overallScore: 68,
      bySource: { reddit: 65, x: 70, youtube: 72, news: 64, instagram: 60, telegram: 63 },
      mentionVolumeChangePct: 22,
      positivePct: 55,
      neutralPct: 30,
      negativePct: 15,
      lastUpdated: daysFromNow(0),
    },
    news: [
      { headline: "Price band announced for PQR Renewables IPO", source: "LiveMint", category: "Pricing", publishedAt: daysFromNow(-1) },
    ],
    status: "upcoming",
  },
  {
    name: "NSE Foods Ltd",
    slug: "nse-foods-ltd",
    board: "Mainboard",
    exchanges: ["NSE", "BSE"],
    priceBandMin: 95,
    priceBandMax: 100,
    lotSize: 150,
    issueSizeCr: 300,
    freshIssueCr: 180,
    ofsCr: 120,
    useOfProceeds: ["Debt repayment", "Working capital"],
    dates: {
      drhpFiled: daysFromNow(-100),
      rhpFiled: daysFromNow(-50),
      anchorDate: daysFromNow(-10),
      openDate: daysFromNow(-9),
      closeDate: daysFromNow(-7),
      allotmentDate: daysFromNow(-4),
      refundDate: daysFromNow(-3),
      creditDate: daysFromNow(-3),
      listingDate: daysFromNow(0),
    },
    fundamentals: {
      score: 58,
      lastCalculated: daysFromNow(-30),
      revenueGrowthPct: 8,
      profitGrowthPct: 4,
      ebitdaGrowthPct: 6,
      eps: 3.2,
      roe: 9.1,
      roce: 10.4,
      debtToEquity: 1.1,
      operatingCashFlowCr: 25,
      freeCashFlowCr: 5,
      marginsPct: 6.5,
      promoterHoldingPct: 58,
      customerConcentrationNote: "Retail distribution, low concentration",
      industry: "FMCG",
    },
    valuation: { peIpo: 26.8, pePeerMedian: 27.5, peIndustryMedian: 28.0, pbIpo: 3.0, evEbitda: 15.6, evSales: 1.8, marketCapCr: 950 },
    gmp: { current: 6, history: gmpHistory(15, 15, 5) },
    subscription: { history: subscriptionHistory(3.1) },
    social: {
      overallScore: 52,
      bySource: { reddit: 50, x: 48, youtube: 55, news: 53, instagram: 51, telegram: 49 },
      mentionVolumeChangePct: -5,
      positivePct: 38,
      neutralPct: 40,
      negativePct: 22,
      lastUpdated: daysFromNow(0),
    },
    news: [{ headline: "NSE Foods set to list today amid muted GMP", source: "CNBC-TV18", category: "Listing", publishedAt: daysFromNow(0) }],
    status: "listed",
  },
];

async function run() {
  await connectDB();
  await Ipo.deleteMany({});
  await Ipo.insertMany(raw);
  console.log(`Seeded ${raw.length} IPOs`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
