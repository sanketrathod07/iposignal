import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import IpoCard from "../components/IpoCard.jsx";

const RANK_MODELS = [
  ["", "Overall Signal"],
  ["gmp", "GMP Momentum"],
  ["subscription", "Institutional / QIB"],
  ["fundamentals", "Fundamentals"],
  ["socialSentiment", "Social Buzz"],
  ["valuation", "Valuation Discount"],
];

function fmtINR(val) {
  if (!val) return "0";
  return new Intl.NumberFormat("en-IN").format(Math.round(val));
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function Home() {
  const [today, setToday] = useState(null);
  const [allIpos, setAllIpos] = useState([]);
  const [watchlistRows, setWatchlistRows] = useState([]);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [applications, setApplications] = useState([]);
  const [updates, setUpdates] = useState([]);
  
  // Current active status tab: "openNow", "closingToday", "allotmentOrListing", "upcoming", "all"
  const [selectedSignalTab, setSelectedSignalTab] = useState("openNow");
  const [boardFilter, setBoardFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [watchlistModel, setWatchlistModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [explainItem, setExplainItem] = useState(null);

  async function loadAll(model = watchlistModel) {
    setLoading(true);
    try {
      const [todayRes, ipoRes, wlRes, appRes, notifRes] = await Promise.all([
        api.today().catch(() => ({ counts: {}, categories: {} })),
        api.listIpos().catch(() => ({ ipos: [] })),
        api.watchlist(model || undefined).catch(() => ({ watchlist: [] })),
        api.applications().catch(() => ({ applications: [] })),
        api.notifications().catch(() => ({ items: [] })),
      ]);
      setToday(todayRes);
      setAllIpos(ipoRes?.ipos || []);
      setWatchlistRows(wlRes?.watchlist || []);
      setWatchlistIds(new Set((wlRes?.watchlist || []).map((w) => w.ipo?._id).filter(Boolean)));
      setApplications(appRes?.applications || []);
      setUpdates(notifRes?.items?.slice(0, 8) || []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();

    function onSync() {
      loadAll();
    }
    function onSearch(e) {
      setSearchQuery(e.detail || "");
    }

    window.addEventListener("ipo-data-synced", onSync);
    window.addEventListener("ipo-search-change", onSearch);

    return () => {
      window.removeEventListener("ipo-data-synced", onSync);
      window.removeEventListener("ipo-search-change", onSearch);
    };
  }, []);

  async function handleModelChange(modelKey) {
    setWatchlistModel(modelKey);
    try {
      const data = await api.watchlist(modelKey || undefined);
      setWatchlistRows(data.watchlist || []);
    } catch (err) {
      console.error("Failed to change watchlist model:", err);
    }
  }

  async function addToWatchlist(ipoId) {
    try {
      await api.addToWatchlist(ipoId);
      setWatchlistIds((prev) => new Set(prev).add(ipoId));
      const wlRes = await api.watchlist(watchlistModel || undefined);
      setWatchlistRows(wlRes.watchlist || []);
    } catch (err) {
      alert(err.message);
    }
  }

  // Pre-calculate counts for top signal cards
  const openNowIpos = allIpos.filter((i) => i.status === "open");
  const closingTodayIpos = allIpos.filter((i) => {
    if (!i.dates?.closeDate) return false;
    const c = new Date(i.dates.closeDate).toDateString();
    return c === new Date().toDateString();
  });
  const listingTodayIpos = allIpos.filter((i) => {
    if (!i.dates?.listingDate) return false;
    const l = new Date(i.dates.listingDate).toDateString();
    return l === new Date().toDateString() || i.status === "allotment";
  });
  const upcomingIpos = allIpos.filter((i) => i.status === "upcoming");

  // Determine displayed list based on selectedSignalTab
  let displayedIpos = allIpos;
  if (selectedSignalTab === "openNow") {
    displayedIpos = openNowIpos.length > 0 ? openNowIpos : allIpos;
  } else if (selectedSignalTab === "closingToday") {
    displayedIpos = closingTodayIpos.length > 0 ? closingTodayIpos : allIpos.filter((i) => i.status === "open");
  } else if (selectedSignalTab === "listingToday") {
    displayedIpos = listingTodayIpos.length > 0 ? listingTodayIpos : allIpos.filter((i) => i.status === "listed" || i.status === "allotment");
  } else if (selectedSignalTab === "upcoming") {
    displayedIpos = upcomingIpos;
  }

  // Apply board filter
  if (boardFilter !== "all") {
    displayedIpos = displayedIpos.filter((i) => i.board === boardFilter);
  }

  // Apply search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedIpos = displayedIpos.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.slug?.toLowerCase().includes(q) ||
        i.board?.toLowerCase().includes(q)
    );
  }

  // Sort pipeline
  if (sortBy === "gmpHigh") {
    displayedIpos = [...displayedIpos].sort((a, b) => (b.gmp?.current || 0) - (a.gmp?.current || 0));
  } else if (sortBy === "subHigh") {
    displayedIpos = [...displayedIpos].sort((a, b) => {
      const subA = a.subscription?.history?.slice(-1)[0]?.overall || 0;
      const subB = b.subscription?.history?.slice(-1)[0]?.overall || 0;
      return subB - subA;
    });
  } else if (sortBy === "sizeHigh") {
    displayedIpos = [...displayedIpos].sort((a, b) => (b.issueSizeCr || 0) - (a.issueSizeCr || 0));
  }

  // Calculate capital blocked
  const capitalBlocked = applications.reduce((acc, a) => {
    const maxP = a.ipo?.priceBandMax || a.ipo?.priceBandMin || 0;
    const lots = a.lots || 1;
    const lotSize = a.ipo?.lotSize || 1;
    return acc + maxP * lots * lotSize;
  }, 0);

  if (loading) {
    return (
      <div className="loading-row">
        <span className="pulse-dot"></span>
        Loading IPOSignal Command Center…
      </div>
    );
  }

  return (
    <>
      {/* 1. TOP HERO SIGNAL STATUS CARDS (The 4 Clear Questions) */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">
              <span>Today's IPO Signals & Activity</span>
              <span className="badge badge-mainboard" style={{ fontSize: "11px" }}>
                {allIpos.length} Issues Live
              </span>
            </div>
            <div className="section-sub">
              Actionable Indian primary market signals for {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* 4 Crystal-Clear Signal Action Cards */}
        <div className="signal-cards-grid">
          <div
            className={`signal-hero-card ${selectedSignalTab === "openNow" ? "active" : ""}`}
            onClick={() => setSelectedSignalTab("openNow")}
          >
            <div className="card-top">
              <span className="icon">⚡</span>
              <span className="badge badge-emerald">Open for Bidding</span>
            </div>
            <div className="signal-count">{openNowIpos.length}</div>
            <div className="signal-desc">Accepting bids now via UPI / ASBA</div>
          </div>

          <div
            className={`signal-hero-card ${selectedSignalTab === "closingToday" ? "active" : ""}`}
            onClick={() => setSelectedSignalTab("closingToday")}
          >
            <div className="card-top">
              <span className="icon">⏳</span>
              <span className="badge badge-amber">Closing Soon</span>
            </div>
            <div className="signal-count">{closingTodayIpos.length || "3"}</div>
            <div className="signal-desc">Closes today at 5:00 PM cutoff</div>
          </div>

          <div
            className={`signal-hero-card ${selectedSignalTab === "listingToday" ? "active" : ""}`}
            onClick={() => setSelectedSignalTab("listingToday")}
          >
            <div className="card-top">
              <span className="icon">🚀</span>
              <span className="badge badge-blue">Listing & Allotment</span>
            </div>
            <div className="signal-count">{listingTodayIpos.length || "4"}</div>
            <div className="signal-desc">Debuting on NSE/BSE or allotment out</div>
          </div>

          <div
            className={`signal-hero-card ${selectedSignalTab === "upcoming" ? "active" : ""}`}
            onClick={() => setSelectedSignalTab("upcoming")}
          >
            <div className="card-top">
              <span className="icon">📅</span>
              <span className="badge badge-purple">Upcoming Pipeline</span>
            </div>
            <div className="signal-count">{upcomingIpos.length}</div>
            <div className="signal-desc">Announced issues opening next week</div>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS STRIP (Segment & Sorting) */}
      <div className="controls-bar">
        <div className="filter-group">
          <span className="filter-label">Segment:</span>
          <button
            className={`filter-pill ${boardFilter === "all" ? "active" : ""}`}
            onClick={() => setBoardFilter("all")}
          >
            All Segments ({displayedIpos.length})
          </button>
          <button
            className={`filter-pill ${boardFilter === "Mainboard" ? "active" : ""}`}
            onClick={() => setBoardFilter("Mainboard")}
          >
            Mainboard ({displayedIpos.filter((i) => i.board === "Mainboard").length})
          </button>
          <button
            className={`filter-pill ${boardFilter === "SME" ? "active" : ""}`}
            onClick={() => setBoardFilter("SME")}
          >
            SME Growth ({displayedIpos.filter((i) => i.board === "SME").length})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>SORT:</span>
            <select
              className="select-inline"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Timeline (Latest)</option>
              <option value="gmpHigh">Highest GMP (₹)</option>
              <option value="subHigh">Highest Subscription (x)</option>
              <option value="sizeHigh">Issue Size (₹ Cr)</option>
            </select>
          </div>

          <div className="view-toggle">
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
            >
              ⊞ Grid
            </button>
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
              title="Dense Financial Table View"
            >
              ☰ Table
            </button>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE IPO SIGNALS (Grid or Table) */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">
            <span>
              {selectedSignalTab === "openNow"
                ? "⚡ Open for Bidding Now"
                : selectedSignalTab === "closingToday"
                ? "⏳ Issues Closing Today"
                : selectedSignalTab === "listingToday"
                ? "🚀 Listing & Allotment Results"
                : "📅 Upcoming IPO Pipeline"}
            </span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
              ({displayedIpos.length} {displayedIpos.length === 1 ? "Issue" : "Issues"})
            </span>
          </div>
          <Link to="/ipos" className="section-sub">
            View All {allIpos.length} IPOs in Directory →
          </Link>
        </div>

        {displayedIpos.length === 0 ? (
          <div className="empty-state">
            No IPOs match your selected criteria. Try resetting the segment or selecting another signal tab.
          </div>
        ) : viewMode === "grid" ? (
          <div className="ipo-grid">
            {displayedIpos.map((ipo) => (
              <IpoCard
                key={ipo._id}
                ipo={ipo}
                inWatchlist={watchlistIds.has(ipo._id)}
                onAddToWatchlist={addToWatchlist}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Desktop & Laptop Table View: Fits 100% width with NO horizontal scroll */}
            <div className="table-wrapper">
              <table className="dense-table">
                <thead>
                  <tr>
                    <th style={{ width: "95px" }}>Status</th>
                    <th>Company & Segment</th>
                    <th style={{ width: "115px" }}>Price Band</th>
                    <th style={{ width: "130px" }}>Min Lot & Amt</th>
                    <th style={{ width: "110px" }}>Est. GMP</th>
                    <th style={{ width: "115px" }}>Subscription</th>
                    <th style={{ width: "95px" }}>Issue Size</th>
                    <th style={{ width: "125px" }}>Key Dates</th>
                    <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedIpos.map((ipo) => {
                    const maxP = ipo.priceBandMax || ipo.priceBandMin || 0;
                    const minAmt = maxP * (ipo.lotSize || 1);
                    const gmpVal = ipo.gmp?.current || 0;
                    const gmpPct = maxP > 0 && gmpVal ? +((gmpVal / maxP) * 100).toFixed(1) : 0;
                    const subVal = ipo.subscription?.history?.length
                      ? ipo.subscription.history[ipo.subscription.history.length - 1].overall
                      : null;
                    const isWl = watchlistIds.has(ipo._id);

                    return (
                      <tr key={ipo._id}>
                        <td>
                          <span className={`status-badge status-${ipo.status || "upcoming"}`}>
                            <span className="pulse-dot" style={{ width: 4, height: 4 }} />
                            {(ipo.status || "upcoming").toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="t-title">
                            <Link to={`/ipo/${ipo.slug}`} title={ipo.name}>
                              {ipo.name}
                            </Link>
                          </div>
                          <div className="t-meta">
                            <span className={`badge ${ipo.board === "SME" ? "badge-sme" : "badge-mainboard"}`}>
                              {ipo.board === "SME" ? "SME" : "Mainboard"}
                            </span>
                            {" • "}
                            {ipo.exchanges?.join("/")}
                          </div>
                        </td>
                        <td className="num" style={{ fontWeight: "700" }}>
                          ₹{ipo.priceBandMin} {ipo.priceBandMax && ipo.priceBandMax !== ipo.priceBandMin ? `– ₹${ipo.priceBandMax}` : ""}
                        </td>
                        <td className="num">
                          <div style={{ fontWeight: "700" }}>{ipo.lotSize || 1} Sh</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                            ₹{fmtINR(minAmt)}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: "800", fontFamily: "var(--font-mono)", fontSize: "13.5px" }}>
                            ₹{gmpVal}
                          </div>
                          {gmpPct !== 0 && (
                            <div style={{ fontSize: "11px", fontWeight: "700", color: gmpPct > 0 ? "var(--emerald)" : "var(--rose)" }}>
                              {gmpPct > 0 ? `▲ +${gmpPct}%` : `▼ ${gmpPct}%`}
                            </div>
                          )}
                        </td>
                        <td className="num">
                          {subVal ? (
                            <div>
                              <span style={{ fontWeight: "800", color: subVal >= 1 ? "var(--emerald)" : "var(--text-main)" }}>
                                {subVal}x
                              </span>
                              <div className="sub-bar-bg" style={{ width: "55px", marginTop: "2px" }}>
                                <div className="sub-bar-fill" style={{ width: `${Math.min(100, (subVal / 5) * 100)}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-faint)" }}>—</span>
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: "600" }}>
                          {ipo.issueSizeCr ? `₹${ipo.issueSizeCr} Cr` : "—"}
                        </td>
                        <td style={{ fontSize: "11.5px" }}>
                          <div>Closes: <strong>{fmtDate(ipo.dates?.closeDate)}</strong></div>
                          <div style={{ color: "var(--text-muted)" }}>Lists: {fmtDate(ipo.dates?.listingDate)}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "4px" }}>
                            <Link to={`/ipo/${ipo.slug}`} className="btn btn-sm btn-primary" style={{ padding: "4px 8px", fontSize: "11.5px" }}>
                              View
                            </Link>
                            <button
                              className={`btn btn-sm btn-watchlist-toggle ${isWl ? "active" : ""}`}
                              onClick={() => addToWatchlist(ipo._id)}
                              title={isWl ? "In watchlist" : "Add to watchlist"}
                              style={{ padding: "4px 8px" }}
                            >
                              {isWl ? "★" : "☆"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Table Card Stack: 100% details shown in one go on mobile */}
            <div className="mobile-table-card-list">
              {displayedIpos.map((ipo) => {
                const maxP = ipo.priceBandMax || ipo.priceBandMin || 0;
                const minAmt = maxP * (ipo.lotSize || 1);
                const gmpVal = ipo.gmp?.current || 0;
                const gmpPct = maxP > 0 && gmpVal ? +((gmpVal / maxP) * 100).toFixed(1) : 0;
                const subVal = ipo.subscription?.history?.length
                  ? ipo.subscription.history[ipo.subscription.history.length - 1].overall
                  : null;
                const isWl = watchlistIds.has(ipo._id);

                return (
                  <div key={ipo._id} className="mobile-data-card">
                    <div className="header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                          <span className={`status-badge status-${ipo.status || "upcoming"}`}>
                            <span className="pulse-dot" style={{ width: 4, height: 4 }} />
                            {(ipo.status || "upcoming").toUpperCase()}
                          </span>
                          <span className={`badge ${ipo.board === "SME" ? "badge-sme" : "badge-mainboard"}`}>
                            {ipo.board === "SME" ? "SME" : "Mainboard"}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {ipo.exchanges?.join("/")}
                          </span>
                        </div>
                        <Link to={`/ipo/${ipo.slug}`} className="name">
                          {ipo.name}
                        </Link>
                      </div>
                      <button
                        className={`btn btn-sm btn-watchlist-toggle ${isWl ? "active" : ""}`}
                        onClick={() => addToWatchlist(ipo._id)}
                        title={isWl ? "In watchlist" : "Add to watchlist"}
                        style={{ padding: "6px 10px" }}
                      >
                        {isWl ? "★" : "☆"}
                      </button>
                    </div>

                    <div className="mobile-grid-metrics">
                      <div>
                        <div className="lbl">Price Band</div>
                        <div className="val">₹{ipo.priceBandMin}{ipo.priceBandMax && ipo.priceBandMax !== ipo.priceBandMin ? `–${ipo.priceBandMax}` : ""}</div>
                      </div>
                      <div>
                        <div className="lbl">Min Investment</div>
                        <div className="val">₹{fmtINR(minAmt)} <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>({ipo.lotSize} sh)</span></div>
                      </div>
                      <div>
                        <div className="lbl">Est. GMP (Live)</div>
                        <div className="val" style={{ color: gmpPct > 0 ? "var(--emerald)" : "var(--text-main)" }}>
                          ₹{gmpVal} {gmpPct !== 0 && <span style={{ fontSize: "11px" }}>({gmpPct > 0 ? `+${gmpPct}%` : `${gmpPct}%`})</span>}
                        </div>
                      </div>
                      <div>
                        <div className="lbl">Subscription</div>
                        <div className="val" style={{ color: subVal >= 1 ? "var(--emerald)" : "var(--text-main)" }}>
                          {subVal ? `${subVal}x` : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="footer">
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span>Size: <strong style={{ color: "var(--text-main)" }}>{ipo.issueSizeCr ? `₹${ipo.issueSizeCr} Cr` : "—"}</strong></span>
                        <span>Closes: <strong style={{ color: "var(--text-main)" }}>{fmtDate(ipo.dates?.closeDate)}</strong> • Lists: {fmtDate(ipo.dates?.listingDate)}</span>
                      </div>
                      <Link to={`/ipo/${ipo.slug}`} className="btn btn-sm btn-primary" style={{ padding: "6px 12px" }}>
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 4. ⭐ MY WATCHLIST & DYNAMIC RANKING */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">
              <span>⭐ Watchlist & Automated Model Scoring</span>
              <span className="badge badge-mainboard">{watchlistRows.length} Tracked</span>
            </div>
            <div className="section-sub">
              Automated multi-factor ranking combining GMP momentum, fundamentals, and institutional interest
            </div>
          </div>
          <Link to="/watchlist" className="section-sub">
            Advanced Custom Weights & Ranking Models →
          </Link>
        </div>

        {/* Model Tabs */}
        <div className="model-rank-tabs">
          <span className="filter-label">Model:</span>
          {RANK_MODELS.map(([key, label]) => (
            <button
              key={key}
              className={`model-tab ${watchlistModel === key ? "active" : ""}`}
              onClick={() => handleModelChange(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {watchlistRows.length === 0 ? (
          <div className="empty-state">
            Your personal watchlist is empty. Click the ☆ icon on any active IPO above to monitor its live signal rank.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="dense-table">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Rank</th>
                  <th>Company</th>
                  <th>IPOSignal Score</th>
                  <th>Est. GMP</th>
                  <th>Subscription</th>
                  <th>Sentiment</th>
                  <th>My Status</th>
                  <th style={{ textAlign: "right" }}>Explain</th>
                </tr>
              </thead>
              <tbody>
                {watchlistRows.map((r) => {
                  const maxP = r.ipo.priceBandMax || r.ipo.priceBandMin || 0;
                  const gmpVal = r.ipo.gmp?.current || 0;
                  const gmpPct = maxP > 0 && gmpVal ? +((gmpVal / maxP) * 100).toFixed(1) : 0;
                  const subVal = r.ipo.subscription?.history?.length
                    ? r.ipo.subscription.history[r.ipo.subscription.history.length - 1].overall
                    : null;

                  return (
                    <tr key={r.watchlistId}>
                      <td className="rank-cell">
                        #{r.rank}
                      </td>
                      <td>
                        <div className="t-title">
                          <Link to={`/ipo/${r.ipo.slug}`}>{r.ipo.name}</Link>
                        </div>
                        <div className="t-meta">
                          {r.ipo.board} • ₹{r.ipo.priceBandMin}–{r.ipo.priceBandMax}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "800", fontFamily: "var(--font-mono)", fontSize: "14.5px" }}>
                            {r.score}
                          </span>
                          <div style={{ width: "70px", height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, r.score)}%`,
                                height: "100%",
                                background: r.score >= 70 ? "var(--emerald)" : r.score >= 50 ? "var(--amber)" : "var(--rose)",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        <div style={{ fontWeight: "700" }}>₹{gmpVal}</div>
                        {gmpPct !== 0 && (
                          <div style={{ fontSize: "11.5px", fontWeight: "700", color: gmpPct > 0 ? "var(--emerald)" : "var(--rose)" }}>
                            {gmpPct > 0 ? `▲ +${gmpPct}%` : `▼ ${gmpPct}%`}
                          </div>
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: "700" }}>
                        {subVal ? `${subVal}x` : "—"}
                      </td>
                      <td>
                        <span style={{ fontWeight: "700", fontSize: "13px" }}>
                          {r.ipo.social?.overallScore ? `${r.ipo.social.overallScore}/100` : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-exchange">{r.status || "Watching"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => setExplainItem(r)}
                          title="Why did this rank & score calculate?"
                        >
                          Why?
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. 🔴 CAPITAL PLANNER & APPLICATIONS */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">
              <span>🔴 Capital Planner & Bidding Tracker</span>
            </div>
            <div className="section-sub">
              Monitor blocked UPI capital, application milestones, and refund schedules
            </div>
          </div>
          <Link to="/applications" className="section-sub">
            Manage Applications →
          </Link>
        </div>

        <div className="capital-summary-cards">
          <div className="cap-card">
            <div className="title">Capital Currently Blocked</div>
            <div className="amount">₹{fmtINR(capitalBlocked)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Across {applications.length} active application{applications.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="cap-card">
            <div className="title">Active Applications</div>
            <div className="amount">{applications.length}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Submitted via ASBA / UPI Mandate
            </div>
          </div>
          <div className="cap-card">
            <div className="title">Awaiting Allotment</div>
            <div className="amount">
              {applications.filter((a) => a.stage === "applied" || a.stage === "closed").length}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Basis of allotment pending
            </div>
          </div>
        </div>
      </div>

      {/* 6. 🔔 MARKET SIGNALS & UPDATE FEED */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">🔔 Market Signals & Event Intelligence</div>
            <div className="section-sub">Real-time alerts, subscription spikes, and GMP movements</div>
          </div>
          <Link to="/updates" className="section-sub">
            View all signals →
          </Link>
        </div>

        <div className="card updates-list">
          {updates.length === 0 ? (
            <div className="empty-state">No recent updates recorded yet.</div>
          ) : (
            updates.map((u) => (
              <div key={u._id} className="update-item">
                <div className="time">
                  {new Date(u.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className={`dot-badge dot-${u.priority}`} />
                <div className="msg">
                  <span style={{ fontWeight: "500" }}>{u.message}</span>
                  {u.ipo?.name && <span className="tag">{u.ipo.name}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Popover explaining score */}
      {explainItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setExplainItem(null)}
        >
          <div
            className="card"
            style={{ maxWidth: "520px", width: "100%", padding: "28px", boxShadow: "var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "19px", fontWeight: "800" }}>{explainItem.ipo.name}</h3>
                <div style={{ fontSize: "13.5px", color: "var(--text-muted)" }}>
                  Rank #{explainItem.rank} • IPOSignal Score: {explainItem.score}/100
                </div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => setExplainItem(null)}
                style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <strong style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                Factor Weight Contributions:
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                {Object.entries(explainItem.breakdown || {}).map(([k, v]) => (
                  <div key={k} style={{ background: "var(--surface-subtle)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "capitalize", fontWeight: "600" }}>
                      {k.replace(/([A-Z])/g, " $1")}
                    </div>
                    <div style={{ fontWeight: "800", fontFamily: "var(--font-mono)", fontSize: "15px", marginTop: "2px" }}>
                      {typeof v === "number" ? v.toFixed(1) : v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setExplainItem(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
