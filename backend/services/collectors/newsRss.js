import { XMLParser } from "fast-xml-parser";

// Google News RSS search is free and needs no API key. It's less structured
// than a real news API (no engagement metrics, headline + snippet only) but
// it's a reasonable zero-config default. Swap in NewsAPI.org / a paid news
// API here later for richer data — same return shape, so nothing else
// needs to change.

const parser = new XMLParser({ ignoreAttributes: false });

export async function collectNews(ipoName, { region = "IN", lang = "en" } = {}) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    `"${ipoName}" IPO`
  )}&hl=${lang}-${region}&gl=${region}&ceid=${region}:${lang}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.warn("News collector: network error", err.message);
    return [];
  }

  if (!res.ok) {
    console.warn(`News collector: request failed (${res.status})`);
    return [];
  }

  const xml = await res.text();
  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    console.warn("News collector: failed to parse RSS", err.message);
    return [];
  }

  const items = parsed?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, 20).map((item) => ({
    source: "news",
    sourceName: item.source?.["#text"] || item.source || "Google News",
    author: item.source?.["#text"] || undefined,
    text: (item.title || "").slice(0, 2000),
    url: item.link,
    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    engagement: { upvotesOrLikes: 0, comments: 0 },
  })).filter((n) => n.url);
}
