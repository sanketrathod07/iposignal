import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

const STAGES = ["Applied", "IPO Closed", "Basis of Allotment", "Allotment Result", "Refund", "Shares Credited", "Listed"];

function priorityFor(stage) {
  if (stage === "Applied" || stage === "IPO Closed") return "critical";
  if (stage === "Basis of Allotment" || stage === "Allotment Result") return "important";
  return "normal";
}
const DOT = { critical: "🔴", important: "🟠", normal: "🟢" };

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [capitalBlocked, setCapitalBlocked] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.applications();
    setApps(data.applications);
    setCapitalBlocked(data.capitalBlocked);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function advanceStage(app) {
    const idx = STAGES.indexOf(app.stage);
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    await api.updateApplication(app._id, { stage: next });
    load();
  }

  if (loading) return <div className="loading-row">Loading applications…</div>;

  return (
    <>
      <div className="section">
        <div className="section-head">
          <div className="section-title">My Applications</div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-sub" style={{ marginBottom: 6 }}>Capital currently blocked</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--accent-strong)" }}>
            ₹{capitalBlocked.toLocaleString("en-IN")}
          </div>
        </div>

        {apps.length === 0 ? (
          <div className="empty-state">No applications recorded yet. Apply to an IPO from its detail page to track it here.</div>
        ) : (
          <div className="app-list">
            {apps.map((a) => {
              const p = priorityFor(a.stage);
              return (
                <div key={a._id} className={`app-row ${p}`}>
                  <span className="priority-dot">{DOT[p]}</span>
                  <div style={{ flex: 1 }}>
                    <div className="app-name">
                      {a.ipo?.slug ? (
                        <Link to={`/ipo/${a.ipo.slug}`} style={{ color: "var(--text-main)" }}>
                          {a.ipo?.name}
                        </Link>
                      ) : (
                        a.ipo?.name
                      )}
                    </div>
                    <div className="app-meta">
                      {a.stage} • {a.lots} lot{a.lots > 1 ? "s" : ""}
                      {a.amountBlocked ? ` • ₹${a.amountBlocked.toLocaleString("en-IN")}` : ""}
                    </div>
                  </div>
                  {a.stage !== "Listed" && (
                    <button className="btn btn-sm" onClick={() => advanceStage(a)}>
                      Advance stage
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
