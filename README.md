# IPO Command Center

A personal Indian IPO research and monitoring dashboard, built on the MERN stack
(MongoDB, Express, React, Node.js). Auth is plain email/password + JWT for now —
swap in Google OAuth later without touching the data model.

This now covers **Phase 1 (Core)** and **Phase 2 (Intelligence)** from the product
spec. Phase 3 (RHP/DRHP AI extraction, backtesting) is not built.

## Stack

- **Backend**: Node.js, Express, MongoDB via Mongoose, JWT auth (bcrypt for password hashing)
- **Frontend**: React 18, Vite, React Router — plain CSS with a small design-token system (no UI kit)

## Project structure

```
backend/
  server.js               Express app entry (optionally schedules the daily job via node-cron)
  config/db.js             Mongo connection
  models/                   User, Ipo, Watchlist, Application, Notification, SocialPost
  routes/                    auth, ipos (+ ranking-snapshot/explain), watchlist, applications,
                              notifications, social (collect/posts/trend)
  middleware/auth.js       JWT verification
  utils/
    ranking.js               Configurable multi-dimension ranking engine + explainScoreChange()
    sentiment.js             Lexicon-based sentiment scorer + discussion-category classifier
    dataConfidence.js        Confidence-tier labels + GMP conflict detection
  services/
    socialAggregator.js      Orchestrates collectors, scores + stores posts, updates ipo.social
    collectors/
      reddit.js                Reddit public JSON search (no API key needed)
      newsRss.js                Google News RSS (no API key needed)
      youtube.js                YouTube Data API v3 (needs YOUTUBE_API_KEY, else returns [])
      stubs.js                  X/Telegram/Instagram — documented stubs, see file comments
  scripts/dailySnapshot.js  The "what changed today?" job: ranking snapshots + social refresh + alerts
  seed/seed.js               Sample data: 4 realistic IPOs across every lifecycle stage

frontend/
  src/
    api/client.js            Thin fetch wrapper, talks to /api (proxied to :5000 in dev)
    context/AuthContext.jsx
    pages/                    Login, Register, Home, Watchlist, Applications, Updates, IpoDetail
    components/               IpoCard, TodayCategories, Sparkline, ConfidenceBadge
    styles.css                 Design tokens + all component styles
```

## Running locally

You need Node.js 18+ and a MongoDB instance (local `mongod`, or a free Atlas cluster).

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set MONGO_URI to your Mongo connection string, and JWT_SECRET to a random string
npm install
npm run seed     # loads 4 sample IPOs into the database
npm run dev       # starts the API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev       # starts the app on http://localhost:5173
```

Open http://localhost:5173, register an account (email/password — no verification
step in this phase), and you'll land on the Today's Activity homepage with the 4
seeded IPOs to explore: add to watchlist, change rank-by model, record an
application, and watch the Updates feed populate.

### 3. Optional: Phase 2 intelligence layer

```bash
# One-off: collect Reddit + Google News mentions for a single IPO and score them
curl -X POST http://localhost:5000/api/ipos/abc-technologies/social/collect \
  -H "Authorization: Bearer <your JWT>"

# One-off: take a ranking snapshot (needed at least twice, on different days,
# before the "why did rank change?" explanation has anything to show)
curl -X POST http://localhost:5000/api/ipos/abc-technologies/ranking-snapshot \
  -H "Authorization: Bearer <your JWT>"

# Or run everything for every IPO at once:
npm run daily-job
```

To run this automatically every day, either add a real crontab entry:

```
0 7 * * * cd /path/to/backend && npm run daily-job >> /var/log/ipo-cc-daily.log 2>&1
```

or set `RUN_CRON=true` in `.env` (and optionally `CRON_SCHEDULE`) so `server.js`
schedules it in-process via `node-cron` — simpler for local dev, a real crontab
is more robust for production.

YouTube collection is skipped silently unless you set `YOUTUBE_API_KEY` in `.env`
(free tier, get one at https://console.cloud.google.com/apis/credentials after
enabling "YouTube Data API v3"). X/Twitter, Telegram and Instagram are not wired
to live data — see the comments in `services/collectors/stubs.js` for exactly why
(paid API tiers / app-review requirements) and where to plug in real credentials
once you have them.

## What's new in Phase 2

- **Social aggregation**: `services/socialAggregator.js` pulls from Reddit (public
  JSON search, no key) and Google News RSS (no key) live, plus YouTube if you add
  a key. Posts are deduped by URL, run through a lexicon-based sentiment scorer
  and a discussion-category classifier (analysis / news / positive / negative /
  questions / rumour / promotional), weighted by recency + engagement + source
  quality, and rolled up into `ipo.social.bySource` / `overallScore` / the
  positive-neutral-negative split.
- **Sentiment history**: every collection run appends a point to
  `ipo.social.sentimentHistory`, rendered as a trend sparkline on the IPO detail
  page's Social tab.
- **Ranking history + "why did rank change?"**: `POST /ipos/:slug/ranking-snapshot`
  appends today's score/rank/breakdown to `ipo.rankingHistory`;
  `GET /ipos/:slug/ranking-explain` diffs the two most recent snapshots and
  returns each dimension's contribution to the score change, sorted by impact —
  shown on the new **Ranking** tab.
- **Data confidence + conflict detection**: every IPO detail response now includes
  a `dataConfidence` map (Official / Verified third-party / Community / Unofficial
  / Estimated per metric family), shown as badges next to GMP and Social. GMP
  conflict detection (`utils/dataConfidence.js`) is ready to flag disagreement once
  you wire up a second GMP source — right now there's only one source per point,
  so nothing to conflict yet.
- **The "what changed today?" job**: `scripts/dailySnapshot.js` snapshots every
  IPO's ranking, refreshes social sentiment, and creates a "rank change" notification
  for every user watching an IPO whose rank moved by 3+ (the default alert
  threshold) — this is what turns the Updates feed from static to genuinely daily.

## What's implemented vs. the full spec

**Implemented (Phase 1 + 2):**
- Today's IPO Activity categories (opening/closing/listing/allotment today & tomorrow), computed dynamically from IPO dates
- IPO database with pricing, structure (fresh/OFS split), fundamentals, valuation, full lifecycle dates
- GMP time-series with history, shown with direction arrows; explicitly labeled unofficial
- Day-wise subscription (QIB/NII/Retail/Overall)
- Watchlist with a real multi-dimension ranking engine (`utils/ranking.js`) — fundamentals, valuation, GMP, GMP trend, subscription, social sentiment, risk, IPO structure, each normalized 0–100 and combined by configurable weights. "Rank by" dropdown lets you view by any single dimension or the overall blended score.
- My Status per watchlist IPO (Watching → Applied → Allotted → Listed → Exited, etc.)
- Applications tracker: lots, capital blocked total, stage advancement (Applied → IPO Closed → ... → Listed)
- Unified Notifications center: priority levels, "since you last visited" count, mark-all-read
- IPO detail page with tabs: Overview, GMP, Subscription, Fundamentals, Valuation, Social, News, Timeline, **Ranking**
- Source-transparency framing: GMP and social data are visually separated and labeled unofficial throughout, now backed by real confidence badges
- **Live Reddit + Google News mentions**, lexicon-based sentiment scoring, discussion filtering by category/source
- **Sentiment history trend chart**, **ranking history trend chart**, **"why did rank change?" breakdown**
- **Daily job** (`npm run daily-job` or scheduled via cron / `RUN_CRON=true`) that snapshots rankings, refreshes social data, and notifies watchers of significant rank moves

**Not yet implemented (needs live data sources / more work):**
- Live NSE/BSE/SEBI data ingestion (seed data is static sample data; GMP/subscription still need a real market-data source wired into the existing `gmp.history` / `subscription.history` arrays)
- Real X/Twitter, Telegram, Instagram collection (stubbed — see `services/collectors/stubs.js` for why and how to add real credentials later)
- YouTube collection works but needs you to supply a free `YOUTUBE_API_KEY`
- RHP/DRHP document upload + AI extraction, DRHP→RHP diffing (Phase 3)
- Backtesting / historical model performance against actual listing outcomes (Phase 3)
- Multi-source GMP conflict detection UI (the detection logic exists in `utils/dataConfidence.js` and is ready to use — it just needs a second GMP source to have anything to compare)
- Custom named ranking models saved per user (the `User.rankingModels` field exists in the schema; only the settings UI to manage it is left to build)
- Push notifications (in-app Notifications center works now; browser push is separate)
- Google OAuth (swap into `routes/auth.js` + `AuthContext.jsx` when ready)

## Auth

Currently: register with name/email/password, bcrypt-hashed, JWT issued on login
(30-day expiry), stored in `localStorage`. To add Google OAuth later, add
`passport-google-oauth20` (or similar) to `routes/auth.js`, add a `googleId` field
to `User`, and keep issuing the same JWTs — the rest of the app doesn't need to change.
