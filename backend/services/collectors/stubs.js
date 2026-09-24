// X (Twitter), Telegram and Instagram do not have a free, unauthenticated
// public search API the way Reddit and Google News RSS do:
//
// - X/Twitter: the v2 API's search endpoint requires a paid Basic/Pro tier
//   (as of the last API pricing change) and OAuth app credentials. Scraping
//   the public site directly breaks their Terms of Service and is fragile
//   (no stable HTML contract). If you have paid API access, wire it up here
//   using the same return shape as the other collectors.
// - Telegram: only *your own* bot can read messages in channels/groups it
//   has been added to (Bot API), or you'd need the MTProto client API with
//   a logged-in user session — both require you to set up a bot/app and
//   add it to the specific channels you want tracked. There's no generic
//   "search all of Telegram" endpoint.
// - Instagram: the Graph API only exposes content for Instagram Business
//   accounts you manage, via Meta App Review — not public hashtag search
//   for arbitrary terms.
//
// These stubs keep the aggregator's interface consistent (same call
// signature, same return shape as the working collectors) so you can drop
// in real integrations once you have the relevant credentials, without
// touching services/socialAggregator.js.

export async function collectX(_ipoName) {
  return [];
}

export async function collectTelegram(_ipoName) {
  return [];
}

export async function collectInstagram(_ipoName) {
  return [];
}
