import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import IpoCard from "../components/IpoCard.jsx";

function fmtINR(val) {
  if (!val) return "0";
  return new Intl.NumberFormat("en-IN").format(Math.round(val));
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function IposDirectory() {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boardFilter, setBoardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("table"); // Default to Table on directory page for fast scanning
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  async function loadData() {
    setLoading(true);
    try {
      const [ipoRes, wlRes] = await Promise.all([
        api.listIpos().catch(() => ({ ipos: [] })),
        api.watchlist().catch(() => ({ watchlist: [] })),
      ]);
      setIpos(ipoRes?.ipos || []);
      setWatchlistIds(new Set((wlRes?.watchlist || []).map((w) => w.ipo?._id).filter(Boolean)));
    } catch (err) {
      console.error("Failed to load IPO directory:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    function onSync() {
      loadData();
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

  async function addToWatchlist(ipoId) {
    try {
      await api.addToWatchlist(ipoId);
      setWatchlistIds((prev) => new Set(prev).add(ipoId));
    } catch (err) {
      alert(err.message);
    }
  }

  // Filter pipeline
  let filtered = [...ipos];

  if (boardFilter !== "all") {
    filtered = filtered.filter((i) => i.board === boardFilter);
  }

  if (statusFilter !== "all") {
    filtered = filtered.filter((i) => i.status === statusFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.slug?.toLowerCase().includes(q) ||
        i.board?.toLowerCase().includes(q)
    );
  }

  // Sort pipeline
  if (sortBy === "gmpHigh") {
    filtered.sort((a, b) => (b.gmp?.current || 0) - (a.gmp?.current || 0));
  } else if (sortBy === "subHigh") {
    filtered.sort((a, b) => {
      const subA = a.subscription?.history?.slice(-1)[0]?.overall || 0;
      const subB = b.subscription?.history?.slice(-1)[0]?.overall || 0;
      return subB - subA;
    });
  } else if (sortBy === "sizeHigh") {
    filtered.sort((a, b) => (b.issueSizeCr || 0) - (a.issueSizeCr || 0));
  } else if (sortBy === "priceHigh") {
    filtered.sort((a, b) => (b.priceBandMax || 0) - (a.priceBandMax || 0));
  }

  if (loading) {
    return (
      <div className="loading-row">
        <span className="pulse-dot"></span>
        Loading full IPO directory…
      </div>
    );
  }

  return (
    <div className="section">
      {/* Directory Page Header */}
      <div className="directory-header">
        <div>
          <h1 className="directory-title">
            <span>Indian IPO Directory & Historical Archive</span>
          </h1>
          <p className="directory-sub">
            Browse, search, and filter all <strong>{ipos.length}</strong> active, upcoming, and recently listed Mainboard and SME IPOs on NSE & BSE.
          </p>
        </div>
      </div>

      {/* Advanced Filter Strip */}
      <div className="directory-controls">
        {/* Board Segment Tabs */}
        <div className="filter-group">
          <span className="filter-label">Segment:</span>
          <button
            className={`filter-pill ${boardFilter === "all" ? "active" : ""}`}
            onClick={() => setBoardFilter("all")}
          >
            All Segments ({ipos.length})
          </button>
          <button
            className={`filter-pill ${boardFilter === "Mainboard" ? "active" : ""}`}
            onClick={() => setBoardFilter("Mainboard")}
          >
            Mainboard ({ipos.filter((i) => i.board === "Mainboard").length})
          </button>
          <button
            className={`filter-pill ${boardFilter === "SME" ? "active" : ""}`}
            onClick={() => setBoardFilter("SME")}
          >
            SME Growth ({ipos.filter((i) => i.board === "SME").length})
          </button>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          {[
            ["all", "All"],
            ["open", "Open Now"],
            ["upcoming", "Upcoming"],
            ["allotment", "Allotment"],
            ["listed", "Listed"],
          ].map(([val, label]) => (
            <button
              key={val}
              className={`filter-pill ${statusFilter === val ? "active" : ""}`}
              onClick={() => setStatusFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right side: Sort and View mode */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>SORT:</span>
            <select
              className="select-inline"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Issue Timeline (Latest)</option>
              <option value="gmpHigh">Highest GMP (₹)</option>
              <option value="subHigh">Highest Subscription (x)</option>
              <option value="sizeHigh">Issue Size (₹ Cr)</option>
              <option value="priceHigh">Price Band (₹)</option>
            </select>
          </div>

          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)" }}>
            {filtered.length} IPOs
          </span>

          <div className="view-toggle">
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
              title="Dense Financial Table View"
            >
              ☰ Table
            </button>
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
            >
              ⊞ Grid
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content: Table or Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          No IPOs found matching your selected filters. Try resetting segment or status.
        </div>
      ) : viewMode === "table" ? (
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
                  <th style={{ width: "125px" }}>Timeline</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ipo) => {
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
                            {ipo.board === "SME" ? "SME Growth" : "Mainboard"}
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

          {/* Mobile & Touch Table Card Stack: 100% details shown in one go on mobile screens */}
          <div className="mobile-table-card-list">
            {filtered.map((ipo) => {
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

                  {/* 4-Metric Grid on Mobile */}
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

                  {/* Footer with Issue Size, Dates & Action */}
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
      ) : (
        <div className="ipo-grid">
          {filtered.map((ipo) => (
            <IpoCard
              key={ipo._id}
              ipo={ipo}
              inWatchlist={watchlistIds.has(ipo._id)}
              onAddToWatchlist={addToWatchlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
