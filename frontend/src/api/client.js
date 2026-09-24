const API_HOST = import.meta.env.VITE_API_URL 
  || (import.meta.env.DEV ? "" : "https://iposignal-backend.onrender.com");

const BASE = `${API_HOST.replace(/\/$/, "")}/api`;

function getToken() {
  return localStorage.getItem("ipo_cc_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),

  listIpos: (params = "") => request(`/ipos${params}`),
  today: () => request("/ipos/today"),
  syncLiveData: () => request("/ipos/sync", { method: "POST" }),
  ipoBySlug: (slug) => request(`/ipos/${slug}`),
  rankAll: () => request("/ipos/rank/all"),

  // Phase 2 — ranking history / explain
  takeRankingSnapshot: (slug) => request(`/ipos/${slug}/ranking-snapshot`, { method: "POST" }),
  rankingExplain: (slug) => request(`/ipos/${slug}/ranking-explain`),

  // Phase 2 — social intelligence
  collectSocial: (slug) => request(`/ipos/${slug}/social/collect`, { method: "POST" }),
  rescoreSocial: (slug) => request(`/ipos/${slug}/social/rescore`, { method: "POST" }),
  socialPosts: (slug, { category, source } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (source) params.set("source", source);
    const qs = params.toString();
    return request(`/ipos/${slug}/social/posts${qs ? `?${qs}` : ""}`);
  },
  socialTrend: (slug) => request(`/ipos/${slug}/social/trend`),

  watchlist: (model) => request(`/watchlist${model ? `?model=${model}` : ""}`),
  addToWatchlist: (ipoId) => request("/watchlist", { method: "POST", body: { ipoId } }),
  updateWatchlist: (id, payload) => request(`/watchlist/${id}`, { method: "PATCH", body: payload }),
  removeFromWatchlist: (id) => request(`/watchlist/${id}`, { method: "DELETE" }),

  applications: () => request("/applications"),
  addApplication: (payload) => request("/applications", { method: "POST", body: payload }),
  updateApplication: (id, payload) => request(`/applications/${id}`, { method: "PATCH", body: payload }),

  notifications: () => request("/notifications"),
  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
};

export { getToken };
