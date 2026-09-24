import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import Sparkline from "../components/Sparkline.jsx";
import ConfidenceBadge from "../components/ConfidenceBadge.jsx";

const TABS = ["Overview", "GMP", "Subscription", "Fundamentals", "Valuation", "Social", "News", "Timeline", "Ranking"];
const POST_CATEGORIES = ["all", "analysis", "news", "positive", "negative", "questions", "rumour", "promotional"];
const POST_SOURCES = ["all", "reddit", "news", "youtube", "x", "telegram", "instagram"];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Row({ label, value }) {
  return (
    <div className="price-row" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="section-sub">{label}</span>
      <span className="val num">{value ?? "—"}</span>
    </div>
  );
}

export default function IpoDetail() {
  const { slug } = useParams();
  const [ipo, setIpo] = useState(null);
  const [confidence, setConfidence] = useState({});
  const [tab, setTab] = useState("Overview");
  const [inWatchlist, setInWatchlist] = useState(false);
  const [lots, setLots] = useState(1);
  const [applyMsg, setApplyMsg] = useState("");

  // Phase 2 state
  const [posts, setPosts] = useState([]);
  const [postFilter, setPostFilter] = useState({ category: "all", source: "all" });
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialMsg, setSocialMsg] = useState("");
  const [rankExplain, setRankExplain] = useState(null);
  const [rankHistory, setRankHistory] = useState([]);
  const [rankBusy, setRankBusy] = useState(false);

  async function load() {
    const data = await api.ipoBySlug(slug);
    setIpo(data.ipo);
    setConfidence(data.dataConfidence || {});
    const wl = await api.watchlist();
    setInWatchlist(wl.watchlist.some((w) => w.ipo._id === data.ipo._id));
  }

  async function loadPosts(filter = postFilter) {
    const data = await api.socialPosts(slug, filter);
    setPosts(data.posts);
  }

  async function loadRanking() {
    const data = await api.rankingExplain(slug);
    setRankExplain(data.explain);
    setRankHistory(data.history || []);
  }

  async function runSocialCollect() {
    setSocialBusy(true);
    setSocialMsg("");
    try {
      const data = await api.collectSocial(slug);
      setSocialMsg(
        `Collected ${data.result.newMentions} mentions, considered ${data.result.postsConsidered} in the last 7 days. Overall sentiment: ${data.result.overallScore}/100.`
      );
      await load();
      await loadPosts();
    } catch (err) {
      setSocialMsg(`Collection failed: ${err.message}`);
    } finally {
      setSocialBusy(false);
    }
  }

  async function takeSnapshot() {
    setRankBusy(true);
    try {
      await api.takeRankingSnapshot(slug);
      await loadRanking();
    } catch (err) {
      alert(err.message);
    } finally {
      setRankBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (tab === "Social") loadPosts();
    if (tab === "Ranking") loadRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, slug]);

  if (!ipo) return <div className="loading-row">Loading IPO…</div>;

  async function addWatchlist() {
    await api.addToWatchlist(ipo._id);
    setInWatchlist(true);
  }

  async function apply() {
    const amount = lots * ipo.lotSize * ipo.priceBandMax;
    await api.addApplication({ ipoId: ipo._id, lots, amountBlocked: amount });
    setApplyMsg(`Application recorded: ${lots} lot(s), ₹${amount.toLocaleString("en-IN")}`);
  }

  const latestSub = ipo.subscription?.history?.length
    ? ipo.subscription.history[ipo.subscription.history.length - 1]
    : null;

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <div className="section-title">{ipo.name}</div>
          <div className="section-sub">
            {ipo.board} • {ipo.exchanges?.join("/")} •{" "}
            <span className={`status-tag status-${ipo.status}`}>{ipo.status?.toUpperCase()}</span>
          </div>
        </div>
        <button className="btn btn-primary" disabled={inWatchlist} onClick={addWatchlist}>
          {inWatchlist ? "★ In Watchlist" : "+ Add to Watchlist"}
        </button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="card">
          <Row label="Price band" value={`₹${ipo.priceBandMin}–₹${ipo.priceBandMax}`} />
          <Row label="Lot size" value={ipo.lotSize} />
          <Row label="Issue size" value={`₹${ipo.issueSizeCr} Cr`} />
          <Row label="Fresh issue / OFS" value={`₹${ipo.freshIssueCr} Cr / ₹${ipo.ofsCr} Cr`} />
          <Row label="GMP" value={`₹${ipo.gmp?.current ?? "—"} (${ipo.priceBandMin ? Math.round((ipo.gmp?.current / ipo.priceBandMin) * 100) : "—"}%)`} />
          <Row label="Subscription (overall)" value={latestSub ? `${latestSub.overall}x` : "—"} />
          <Row label="Closes" value={fmtDate(ipo.dates?.closeDate)} />
          <Row label="Listing" value={fmtDate(ipo.dates?.listingDate)} />

          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div className="section-sub" style={{ marginBottom: 8 }}>Apply to this IPO</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="search-input"
                type="number"
                min={1}
                style={{ maxWidth: 90 }}
                value={lots}
                onChange={(e) => setLots(Math.max(1, Number(e.target.value)))}
              />
              <span className="section-sub">lot(s)</span>
              <button className="btn btn-primary btn-sm" onClick={apply}>
                Record Application
              </button>
            </div>
            {applyMsg && <div className="section-sub" style={{ marginTop: 8, color: "var(--positive)" }}>{applyMsg}</div>}
          </div>
        </div>
      )}

      {tab === "GMP" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Row label="Current GMP" value={`₹${ipo.gmp?.current ?? "—"}`} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6, marginBottom: 6 }}>
            <ConfidenceBadge level={confidence.gmp} />
          </div>
          {ipo.gmp?.history?.length > 1 && (
            <div style={{ margin: "10px 0" }}>
              <Sparkline points={ipo.gmp.history.map((p) => ({ value: p.value }))} />
            </div>
          )}
          <div className="section-sub" style={{ margin: "10px 0" }}>Recent history (unofficial / market-indicated data)</div>
          <div className="table-scroll-wrap">
            <table className="wl-table">
              <thead>
                <tr><th>Date</th><th>GMP (₹)</th><th>Source</th></tr>
              </thead>
              <tbody>
                {(ipo.gmp?.history || []).slice(-10).reverse().map((p, i) => (
                  <tr key={i}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="num">₹{p.value}</td>
                    <td className="section-sub">{p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-sub" style={{ marginTop: 10 }}>
            ⚠ GMP is unofficial market-indicated data and does not guarantee listing performance.
          </div>
        </div>
      )}

      {tab === "Subscription" && (
        <div className="card">
          {(!ipo.subscription?.history || ipo.subscription.history.length === 0) ? (
            <div className="empty-state">Subscription data not yet available.</div>
          ) : (
            <div className="table-scroll-wrap">
              <table className="wl-table">
                <thead>
                  <tr><th>Day</th><th>QIB</th><th>NII</th><th>Retail</th><th>Overall</th></tr>
                </thead>
                <tbody>
                  {ipo.subscription.history.map((p, i) => (
                    <tr key={i}>
                      <td>Day {p.day}</td>
                      <td className="num">{p.qib?.toFixed?.(2) ?? "—"}x</td>
                      <td className="num">{p.nii?.toFixed?.(2) ?? "—"}x</td>
                      <td className="num">{p.retail?.toFixed?.(2) ?? "—"}x</td>
                      <td className="num" style={{ fontWeight: 600 }}>{p.overall?.toFixed?.(2) ?? "—"}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "Fundamentals" && (
        <div className="card">
          <Row label="Fundamentals score" value={`${ipo.fundamentals?.score ?? "—"} / 100`} />
          <Row label="Last calculated" value={fmtDate(ipo.fundamentals?.lastCalculated)} />
          <Row label="Revenue growth" value={`${ipo.fundamentals?.revenueGrowthPct ?? "—"}%`} />
          <Row label="Profit growth" value={`${ipo.fundamentals?.profitGrowthPct ?? "—"}%`} />
          <Row label="EBITDA growth" value={`${ipo.fundamentals?.ebitdaGrowthPct ?? "—"}%`} />
          <Row label="EPS" value={ipo.fundamentals?.eps} />
          <Row label="ROE / ROCE" value={`${ipo.fundamentals?.roe ?? "—"}% / ${ipo.fundamentals?.roce ?? "—"}%`} />
          <Row label="Debt / Equity" value={ipo.fundamentals?.debtToEquity} />
          <Row label="Operating cash flow" value={`₹${ipo.fundamentals?.operatingCashFlowCr ?? "—"} Cr`} />
          <Row label="Free cash flow" value={`₹${ipo.fundamentals?.freeCashFlowCr ?? "—"} Cr`} />
          <Row label="Margins" value={`${ipo.fundamentals?.marginsPct ?? "—"}%`} />
          <Row label="Promoter holding" value={`${ipo.fundamentals?.promoterHoldingPct ?? "—"}%`} />
          <Row label="Industry" value={ipo.fundamentals?.industry} />
          <Row label="Customer concentration" value={ipo.fundamentals?.customerConcentrationNote} />
        </div>
      )}

      {tab === "Valuation" && (
        <div className="card">
          <Row label="P/E — IPO" value={ipo.valuation?.peIpo} />
          <Row label="P/E — Peer median" value={ipo.valuation?.pePeerMedian} />
          <Row label="P/E — Industry median" value={ipo.valuation?.peIndustryMedian} />
          <Row label="P/B" value={ipo.valuation?.pbIpo} />
          <Row label="EV/EBITDA" value={ipo.valuation?.evEbitda} />
          <Row label="EV/Sales" value={ipo.valuation?.evSales} />
          <Row label="Market cap" value={`₹${ipo.valuation?.marketCapCr ?? "—"} Cr`} />
        </div>
      )}

      {tab === "Social" && (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Row label="Overall sentiment" value={`${ipo.social?.overallScore ?? "—"} / 100`} />
                <Row label="Mention volume change (7d)" value={`${ipo.social?.mentionVolumeChangePct ?? "—"}%`} />
                <Row label="Positive / Neutral / Negative" value={`${ipo.social?.positivePct ?? 0}% / ${ipo.social?.neutralPct ?? 0}% / ${ipo.social?.negativePct ?? 0}%`} />
              </div>
              <div style={{ textAlign: "right" }}>
                <ConfidenceBadge level={confidence.social} />
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={runSocialCollect} disabled={socialBusy}>
                    {socialBusy ? "Collecting…" : "Collect latest mentions"}
                  </button>
                </div>
              </div>
            </div>

            {socialMsg && <div className="section-sub" style={{ marginTop: 10 }}>{socialMsg}</div>}

            {ipo.social?.sentimentHistory?.length > 1 && (
              <div style={{ margin: "14px 0" }}>
                <div className="section-sub" style={{ marginBottom: 4 }}>Sentiment trend</div>
                <Sparkline points={ipo.social.sentimentHistory.map((p) => ({ value: p.overallScore }))} />
              </div>
            )}

            <div className="section-sub" style={{ margin: "12px 0 6px" }}>By source (— means nothing collected yet)</div>
            {ipo.social?.bySource &&
              Object.entries(ipo.social.bySource).map(([src, score]) => (
                <Row key={src} label={src[0].toUpperCase() + src.slice(1)} value={score === null || score === undefined ? "—" : `${score} / 100`} />
              ))}

            <div className="section-sub" style={{ marginTop: 10 }}>
              Reddit and Google News collect live. YouTube needs a YOUTUBE_API_KEY set on the server. X, Telegram and
              Instagram need paid/app-review API access and aren't wired up (see services/collectors/stubs.js).
              Community discussion is unofficial and can include speculation or promotional content — treat separately
              from official data.
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="section-sub" style={{ marginBottom: 8 }}>Discussion</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <select
                className="select-inline"
                value={postFilter.category}
                onChange={(e) => {
                  const f = { ...postFilter, category: e.target.value };
                  setPostFilter(f);
                  loadPosts(f);
                }}
              >
                {POST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All categories" : c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <select
                className="select-inline"
                value={postFilter.source}
                onChange={(e) => {
                  const f = { ...postFilter, source: e.target.value };
                  setPostFilter(f);
                  loadPosts(f);
                }}
              >
                {POST_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All sources" : s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {posts.length === 0 ? (
              <div className="empty-state">
                No discussion collected yet for this filter. Click "Collect latest mentions" above.
              </div>
            ) : (
              <div className="updates-list">
                {posts.map((p) => (
                  <div key={p._id} className="update-item">
                    <div className="time">
                      {p.source} • {new Date(p.publishedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </div>
                    <div className={`dot-badge ${p.sentiment === "positive" ? "dot-normal" : p.sentiment === "negative" ? "dot-critical" : "dot-important"}`} />
                    <div className="msg" style={{ flex: 1 }}>
                      {p.text}
                      <div className="tag">
                        {p.sourceName} • {p.category} •{" "}
                        {p.engagement?.upvotesOrLikes || 0} 👍 {p.engagement?.comments || 0} 💬 •{" "}
                        <a href={p.url} target="_blank" rel="noreferrer">Open source</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "News" && (
        <div className="card updates-list">
          {(!ipo.news || ipo.news.length === 0) ? (
            <div className="empty-state">No news items yet.</div>
          ) : (
            ipo.news.map((n, i) => (
              <div key={i} className="update-item">
                <div className="time">{fmtDate(n.publishedAt)}</div>
                <div className="dot-badge dot-normal" />
                <div className="msg">
                  {n.headline}
                  <div className="tag">{n.source} • {n.category}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Timeline" && (
        <div className="card">
          <Row label="DRHP filed" value={fmtDate(ipo.dates?.drhpFiled)} />
          <Row label="RHP filed" value={fmtDate(ipo.dates?.rhpFiled)} />
          <Row label="Anchor allocation" value={fmtDate(ipo.dates?.anchorDate)} />
          <Row label="IPO opens" value={fmtDate(ipo.dates?.openDate)} />
          <Row label="IPO closes" value={fmtDate(ipo.dates?.closeDate)} />
          <Row label="Allotment" value={fmtDate(ipo.dates?.allotmentDate)} />
          <Row label="Refund" value={fmtDate(ipo.dates?.refundDate)} />
          <Row label="Shares credited" value={fmtDate(ipo.dates?.creditDate)} />
          <Row label="Listing" value={fmtDate(ipo.dates?.listingDate)} />
        </div>
      )}

      {tab === "Ranking" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="section-sub">Ranking history (overall model)</div>
            <button className="btn btn-sm" onClick={takeSnapshot} disabled={rankBusy}>
              {rankBusy ? "Saving…" : "Take snapshot today"}
            </button>
          </div>

          {rankHistory.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <Sparkline points={rankHistory.map((p) => ({ value: p.score }))} />
            </div>
          )}

          <div className="table-scroll-wrap">
            <table className="wl-table">
              <thead>
                <tr><th>Date</th><th>Rank</th><th>Score</th></tr>
              </thead>
              <tbody>
                {rankHistory.length === 0 ? (
                  <tr><td colSpan={3} className="section-sub">No snapshots yet — click "Take snapshot today" to start tracking.</td></tr>
                ) : (
                  [...rankHistory].reverse().map((s, i) => (
                    <tr key={i}>
                      <td>{fmtDate(s.date)}</td>
                      <td className="rank-cell">#{s.rank}</td>
                      <td className="num">{s.score}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rankExplain ? (
            <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div className="section-sub" style={{ marginBottom: 8 }}>
                Why did the rank change? (#{rankExplain.previous.rank} → #{rankExplain.current.rank}, score{" "}
                {rankExplain.scoreChange >= 0 ? "+" : ""}{rankExplain.scoreChange})
              </div>
              {rankExplain.contributions.map((c) => (
                <div key={c.dimension} className="price-row" style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="section-sub">{c.label}</span>
                  <span className={`num ${c.weightedDelta > 0 ? "up" : c.weightedDelta < 0 ? "down" : "flat"}`}>
                    {c.weightedDelta >= 0 ? "+" : ""}{c.weightedDelta}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="section-sub" style={{ marginTop: 14 }}>
              Take at least two snapshots on different days to see a "why did rank change?" breakdown.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
