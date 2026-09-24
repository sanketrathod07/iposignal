// Requires a YouTube Data API v3 key (free tier, generous quota) set as
// YOUTUBE_API_KEY. Get one at https://console.cloud.google.com/apis/credentials
// after enabling "YouTube Data API v3" on a project. Without a key, this
// collector returns an empty list rather than failing the whole pipeline.

export async function collectYoutube(ipoName, { maxResults = 10 } = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return []; // silently skip — aggregator will just show 0 YouTube mentions
  }

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date` +
    `&maxResults=${maxResults}&q=${encodeURIComponent(`${ipoName} IPO`)}&key=${apiKey}`;

  let res;
  try {
    res = await fetch(searchUrl);
  } catch (err) {
    console.warn("YouTube collector: network error", err.message);
    return [];
  }
  if (!res.ok) {
    console.warn(`YouTube collector: search failed (${res.status})`);
    return [];
  }

  const data = await res.json().catch(() => null);
  const items = data?.items || [];
  if (items.length === 0) return [];

  // Fetch view/like/comment counts in a second call (search endpoint doesn't include stats).
  const ids = items.map((i) => i.id.videoId).filter(Boolean).join(",");
  let stats = {};
  if (ids) {
    try {
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${apiKey}`
      );
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        for (const v of statsData.items || []) {
          stats[v.id] = v.statistics;
        }
      }
    } catch {
      // stats are best-effort; continue without them
    }
  }

  return items
    .filter((i) => i.id.videoId)
    .map((i) => {
      const s = stats[i.id.videoId] || {};
      return {
        source: "youtube",
        sourceName: i.snippet.channelTitle,
        author: i.snippet.channelTitle,
        text: [i.snippet.title, i.snippet.description].filter(Boolean).join(" — ").slice(0, 2000),
        url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
        publishedAt: new Date(i.snippet.publishedAt),
        engagement: {
          upvotesOrLikes: Number(s.likeCount || 0),
          comments: Number(s.commentCount || 0),
        },
      };
    });
}
