// Reddit's read-only JSON search endpoint is public and needs no API key —
// just a descriptive User-Agent, which Reddit's API rules require.
// Docs: https://www.reddit.com/dev/api#GET_search
// Note: Reddit rate-limits unauthenticated requests fairly aggressively
// (roughly 10 req/min per IP in practice), so callers should not hammer
// this — the aggregator runs it once per IPO per collection cycle.

const USER_AGENT = "ipo-command-center/1.0 (personal IPO research dashboard)";

export async function collectReddit(ipoName, { limit = 25 } = {}) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(ipoName)}&sort=new&limit=${limit}`;

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    console.warn("Reddit collector: network error", err.message);
    return [];
  }

  if (!res.ok) {
    console.warn(`Reddit collector: request failed (${res.status})`);
    return [];
  }

  const data = await res.json().catch(() => null);
  const children = data?.data?.children || [];

  return children
    .map((c) => c.data)
    .filter((post) => post && post.title)
    .map((post) => ({
      source: "reddit",
      sourceName: `r/${post.subreddit}`,
      author: post.author,
      text: [post.title, post.selftext].filter(Boolean).join(" — ").slice(0, 2000),
      url: `https://reddit.com${post.permalink}`,
      publishedAt: new Date(post.created_utc * 1000),
      engagement: {
        upvotesOrLikes: post.ups || 0,
        comments: post.num_comments || 0,
      },
    }));
}
