import { Link } from "react-router-dom";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function gmpDirection(history) {
  if (!history || history.length < 2) return "flat";
  const last = history[history.length - 1].value;
  const prev = history[history.length - 2].value;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

function formatINR(val) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(val);
}

export default function IpoCard({ ipo, onAddToWatchlist, inWatchlist }) {
  const dir = gmpDirection(ipo.gmp?.history);
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  const latestSub = ipo.subscription?.history?.length
    ? ipo.subscription.history[ipo.subscription.history.length - 1].overall
    : null;

  const maxPrice = ipo.priceBandMax || ipo.priceBandMin || 0;
  const minInvestment = maxPrice > 0 && ipo.lotSize ? maxPrice * ipo.lotSize : 0;
  const gmpVal = ipo.gmp?.current || 0;
  const gmpPct = maxPrice > 0 && gmpVal ? +((gmpVal / maxPrice) * 100).toFixed(1) : 0;

  // Visual subscription percentage for bar (capped at 100% for 10x)
  const subPercent = latestSub ? Math.min(100, Math.round((latestSub / 5) * 100)) : 0;

  return (
    <div className={`card ipo-card ${ipo.board === "SME" ? "card-sme" : "card-mainboard"}`}>
      {/* Header Row */}
      <div className="card-header-row">
        <div className="card-title-group">
          <div className="card-company-name" title={ipo.name}>
            <Link to={`/ipo/${ipo.slug}`}>{ipo.name}</Link>
          </div>
          <div className="card-badges-row">
            <span className={`badge ${ipo.board === "SME" ? "badge-sme" : "badge-mainboard"}`}>
              {ipo.board === "SME" ? "SME Growth" : "Mainboard"}
            </span>
            {ipo.exchanges?.map((ex) => (
              <span key={ex} className="badge badge-exchange">
                {ex}
              </span>
            ))}
          </div>
        </div>
        <span className={`status-badge status-${ipo.status || "upcoming"}`}>
          <span className="pulse-dot" style={{ width: 5, height: 5 }} />
          {(ipo.status || "upcoming").toUpperCase()}
        </span>
      </div>

      {/* Dual Metric Box: Price Band & Min Investment */}
      <div className="metric-box-row">
        <div className="metric-item">
          <span className="m-label">Price Band</span>
          <span className="m-val">
            ₹{ipo.priceBandMin} {ipo.priceBandMax && ipo.priceBandMax !== ipo.priceBandMin ? `– ₹${ipo.priceBandMax}` : ""}
          </span>
          <span className="m-sub">Lot Size: {ipo.lotSize || 1} Shares</span>
        </div>
        <div className="metric-item">
          <span className="m-label">Min Investment</span>
          <span className="m-val">
            {minInvestment > 0 ? `₹${formatINR(minInvestment)}` : "—"}
          </span>
          <span className="m-sub">Issue: ₹{ipo.issueSizeCr ? `${ipo.issueSizeCr} Cr` : "TBD"}</span>
        </div>
      </div>

      {/* Real-time GMP & Subscription Showcase Box */}
      <div className="gmp-sub-row">
        <div className="gmp-box">
          <span className="m-label">Est. GMP (Live)</span>
          <div className="gmp-val-row">
            <span className={`gmp-number ${dir}`}>
              ₹{gmpVal || "0"}
            </span>
            {gmpPct !== 0 && (
              <span className="gmp-pct-pill">
                {arrow} {gmpPct > 0 ? `+${gmpPct}%` : `${gmpPct}%`}
              </span>
            )}
          </div>
          <span style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "3px" }}>
            Unofficial Market Data
          </span>
        </div>

        <div className="sub-box">
          <span className="m-label">Subscription</span>
          <div className="sub-multiple">
            {latestSub ? (
              <span style={{ color: latestSub >= 1 ? "var(--emerald)" : "var(--text-main)" }}>
                {latestSub}x
              </span>
            ) : (
              <span style={{ color: "var(--text-faint)", fontWeight: "600" }}>—</span>
            )}
          </div>
          <div className="sub-bar-bg" title={latestSub ? `${latestSub}x Subscribed` : "Not subscribed yet"}>
            <div className="sub-bar-fill" style={{ width: `${subPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Timeline Dates */}
      <div className="card-dates-row">
        <div className="date-pill">
          <span>Closes:</span>
          <strong>{fmtDate(ipo.dates?.closeDate)}</strong>
        </div>
        <div className="date-pill">
          <span>Listing:</span>
          <strong>{fmtDate(ipo.dates?.listingDate)}</strong>
        </div>
      </div>

      {/* Actions */}
      <div className="card-actions">
        <Link to={`/ipo/${ipo.slug}`} className="btn btn-primary" style={{ flex: 1 }}>
          View Details & GMP History →
        </Link>
        <button
          className={`btn btn-watchlist-toggle ${inWatchlist ? "active" : ""}`}
          onClick={() => onAddToWatchlist?.(ipo._id)}
          title={inWatchlist ? "In your watchlist" : "Add to watchlist"}
        >
          {inWatchlist ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}
