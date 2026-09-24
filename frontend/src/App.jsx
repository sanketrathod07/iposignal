import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { api } from "./api/client.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Applications from "./pages/Applications.jsx";
import Updates from "./pages/Updates.jsx";
import IpoDetail from "./pages/IpoDetail.jsx";

import IposDirectory from "./pages/IposDirectory.jsx";

function IpoSignalLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sig-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="accent-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="10" fill="#0f172a" />
      <path d="M7 23 C10 17 14 14 21 13" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 25 L14 19 L19 22 L26 11" stroke="url(#sig-grad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 11 L26 11 L26 17" stroke="url(#accent-g)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="11" r="2.5" fill="#10b981" />
    </svg>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-row">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function TopNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Dashboard" },
    { to: "/ipos", label: "IPO Directory" },
    { to: "/watchlist", label: "Watchlist" },
    { to: "/applications", label: "Applications" },
    { to: "/updates", label: "Signals & News" },
  ];
  return (
    <nav className="top-nav">
      {items.map((it) => (
        <Link key={it.to} to={it.to} className={pathname === it.to ? "active" : ""}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/ipos", label: "IPOs", icon: "📅" },
    { to: "/watchlist", label: "Watchlist", icon: "⭐" },
    { to: "/applications", label: "Portfolio", icon: "💰" },
    { to: "/updates", label: "Signals", icon: "🔔" },
  ];
  return (
    <div className="bottom-nav">
      <div className="nav-row">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={pathname === it.to ? "active" : ""}>
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .notifications()
      .then((d) => setUnread(d.unreadCount || 0))
      .catch(() => {});
  }, [user]);

  async function handleSync() {
    try {
      setSyncing(true);
      await api.syncLiveData();
      window.dispatchEvent(new CustomEvent("ipo-data-synced"));
    } catch (err) {
      alert("Failed to sync live data: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="ticker-tape">
        <div className="ticker-item">
          <span className="ticker-label">Market Feed:</span>
          <span className="ticker-val green">● NSE / BSE LIVE</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Active IPOs:</span>
          <span className="ticker-val">54 Issues</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Top GMP:</span>
          <span className="ticker-val green">+47.2% (SS Retail)</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Open for Bidding:</span>
          <span className="ticker-val amber">17 Open</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Closing Today:</span>
          <span className="ticker-val amber">3 Issues</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Data Engine:</span>
          <span className="ticker-val" style={{ color: "#94a3b8" }}>Real-Time NSE/BSE + InvestorGain GMP</span>
        </div>
      </div>

      <header className="topbar">
        <div className="brand-wrapper">
          <IpoSignalLogo />
          <Link to="/" className="brand">
            <span>IPO</span>
            <span className="brand-accent">Signal</span>
          </Link>
          <div className="live-pulse-badge">
            <span className="pulse-dot"></span>
            LIVE
          </div>
        </div>

        <div className="search-box-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search company, board, ticker..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              window.dispatchEvent(new CustomEvent("ipo-search-change", { detail: e.target.value }));
            }}
          />
        </div>

        <TopNav />

        <div className="topbar-actions">
          <button
            className={`sync-btn ${syncing ? "spinning" : ""}`}
            onClick={handleSync}
            disabled={syncing}
            title="Fetch latest Indian IPO updates & GMP from market feeds"
          >
            <span className="sync-icon">🔄</span>
            <span>{syncing ? "Syncing..." : "Sync Market"}</span>
          </button>

          <Link to="/updates" className="bell-btn" title="Signals & Updates">
            🔔 Updates
            {unread > 0 && <span className="dot">{unread}</span>}
          </Link>

          {user && (
            <div className="user-chip">
              <span>{user.name}</span>
              <button className="logout-btn" onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="content">{children}</div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/ipos" element={<IposDirectory />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/updates" element={<Updates />} />
                <Route path="/ipo/:slug" element={<IpoDetail />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </Protected>
        }
      />
    </Routes>
  );
}
