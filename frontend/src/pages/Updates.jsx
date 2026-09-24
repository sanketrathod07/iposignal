import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Updates() {
  const [items, setItems] = useState([]);
  const [sinceLastVisit, setSinceLastVisit] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.notifications();
    setItems(data.items);
    setSinceLastVisit(data.sinceLastVisit);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await api.markAllRead();
    load();
  }

  if (loading) return <div className="loading-row">Loading updates…</div>;

  // group by day
  const groups = {};
  for (const item of items) {
    const day = new Date(item.createdAt).toDateString();
    groups[day] = groups[day] || [];
    groups[day].push(item);
  }

  return (
    <div className="section">
      <div className="section-head">
        <div className="section-title">🔔 Updates</div>
        <button className="btn btn-sm" onClick={markAllRead}>
          Mark all as read
        </button>
      </div>

      {sinceLastVisit > 0 && (
        <div className="card" style={{ marginBottom: 14, background: "var(--accent-tint)", borderColor: "var(--accent)" }}>
          <strong>{sinceLastVisit}</strong> update{sinceLastVisit > 1 ? "s" : ""} since your last visit
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">No updates yet.</div>
      ) : (
        Object.entries(groups).map(([day, dayItems]) => (
          <div key={day} style={{ marginBottom: 20 }}>
            <div className="section-sub" style={{ marginBottom: 6 }}>
              {new Date(day).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div className="card updates-list">
              {dayItems.map((u) => (
                <div key={u._id} className="update-item" style={{ opacity: u.read ? 0.6 : 1 }}>
                  <div className="time">
                    {new Date(u.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className={`dot-badge dot-${u.priority}`} />
                  <div className="msg">
                    {u.message}
                    {u.ipo?.name && <div className="tag">{u.ipo.name}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
