import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

const RANK_OPTIONS = [
  ["", "Overall"],
  ["fundamentals", "Fundamentals"],
  ["gmp", "GMP"],
  ["gmpTrend", "GMP Momentum"],
  ["subscription", "Subscription"],
  ["socialSentiment", "Social Sentiment"],
  ["valuation", "Valuation"],
  ["risk", "Risk"],
];

const STATUS_OPTIONS = [
  "Watching",
  "Interested",
  "Planning to Apply",
  "Applied",
  "Allotted",
  "Not Allotted",
  "Listed",
  "Holding",
  "Exited",
];

export default function Watchlist() {
  const [rows, setRows] = useState([]);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(m = model) {
    setLoading(true);
    const data = await api.watchlist(m || undefined);
    setRows(data.watchlist);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onModelChange(e) {
    const m = e.target.value;
    setModel(m);
    await load(m);
  }

  async function updateStatus(watchlistId, status) {
    await api.updateWatchlist(watchlistId, { status });
    load(model);
  }

  async function remove(watchlistId) {
    await api.removeFromWatchlist(watchlistId);
    load(model);
  }

  return (
    <div className="section">
      <div className="section-head">
        <div className="section-title">⭐ My Watchlist</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="section-sub">Rank by</span>
          <select className="select-inline" value={model} onChange={onModelChange}>
            {RANK_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-row">Loading watchlist…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          Your watchlist is empty. Browse <Link to="/ipos">all IPOs</Link> and add some to start tracking.
        </div>
      ) : (
        <>
          <div className="card table-wrap desktop-table-only">
            <table className="wl-table">
              <thead>
                <tr>
                  <th style={{ width: "65px" }}>Rank</th>
                  <th>IPO Company</th>
                  <th style={{ width: "100px" }}>GMP</th>
                  <th style={{ width: "110px" }}>Subscription</th>
                  <th style={{ width: "85px" }}>Social</th>
                  <th style={{ width: "100px" }}>Fundamentals</th>
                  <th style={{ width: "80px" }}>Score</th>
                  <th style={{ width: "160px" }}>Status</th>
                  <th style={{ width: "90px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const latestSub = r.ipo.subscription?.history?.length
                    ? r.ipo.subscription.history[r.ipo.subscription.history.length - 1].overall
                    : null;
                  return (
                    <tr key={r.watchlistId}>
                      <td className="rank-cell">#{r.rank}</td>
                      <td>
                        <Link to={`/ipo/${r.ipo.slug}`} style={{ fontWeight: 700, color: "var(--text-main)" }}>
                          {r.ipo.name}
                        </Link>
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>₹{r.ipo.gmp?.current ?? "—"}</td>
                      <td className="num">{latestSub ? `${latestSub}x` : "—"}</td>
                      <td className="num">{r.ipo.social?.overallScore ?? "—"}</td>
                      <td className="num">{r.ipo.fundamentals?.score ?? "—"}</td>
                      <td className="num" style={{ fontWeight: 700, color: "var(--accent)" }}>
                        {r.score}
                      </td>
                      <td>
                        <select
                          className="select-inline"
                          style={{ width: "100%" }}
                          value={r.status}
                          onChange={(e) => updateStatus(r.watchlistId, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => remove(r.watchlistId)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Watchlist Cards */}
          <div className="mobile-wl-card-list">
            {rows.map((r) => {
              const latestSub = r.ipo.subscription?.history?.length
                ? r.ipo.subscription.history[r.ipo.subscription.history.length - 1].overall
                : null;
              return (
                <div key={r.watchlistId} className="mobile-wl-card">
                  <div className="card-top">
                    <span className="rank-pill">#{r.rank}</span>
                    <Link to={`/ipo/${r.ipo.slug}`} className="ipo-title">
                      {r.ipo.name}
                    </Link>
                    <button className="btn btn-xs btn-ghost" onClick={() => remove(r.watchlistId)}>
                      ✕
                    </button>
                  </div>

                  <div className="mobile-grid-metrics">
                    <div>
                      <div className="lbl">Est. GMP</div>
                      <div className="val">₹{r.ipo.gmp?.current ?? "—"}</div>
                    </div>
                    <div>
                      <div className="lbl">Subscription</div>
                      <div className="val">{latestSub ? `${latestSub}x` : "—"}</div>
                    </div>
                    <div>
                      <div className="lbl">Model Score</div>
                      <div className="val" style={{ color: "var(--accent)" }}>{r.score}/100</div>
                    </div>
                    <div>
                      <div className="lbl">Fundamentals</div>
                      <div className="val">{r.ipo.fundamentals?.score ?? "—"}/100</div>
                    </div>
                  </div>

                  <div className="card-bottom">
                    <span className="lbl">Status:</span>
                    <select
                      className="select-inline"
                      style={{ flex: 1 }}
                      value={r.status}
                      onChange={(e) => updateStatus(r.watchlistId, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
