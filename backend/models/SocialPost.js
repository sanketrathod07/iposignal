import mongoose from "mongoose";

// One collected mention of an IPO from a public source. Kept separate from
// the Ipo document (rather than embedded) because volume here can be large
// and most queries only need the last N posts / a filtered slice.
const socialPostSchema = new mongoose.Schema(
  {
    ipo: { type: mongoose.Schema.Types.ObjectId, ref: "Ipo", required: true, index: true },
    source: {
      type: String,
      enum: ["reddit", "x", "youtube", "news", "instagram", "telegram"],
      required: true,
    },
    sourceName: String, // e.g. subreddit name, publication name, channel name
    author: String,
    text: { type: String, required: true },
    url: { type: String, required: true },
    publishedAt: { type: Date, default: Date.now },

    engagement: {
      upvotesOrLikes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
    },

    // Sentiment analysis output (see utils/sentiment.js)
    sentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "neutral" },
    sentimentScore: { type: Number, default: 0 }, // -1 to 1

    // Discussion-quality classification (spec section 18, 21)
    category: {
      type: String,
      enum: ["analysis", "news", "positive", "negative", "questions", "rumour", "promotional", "spam"],
      default: "analysis",
    },
    sourceQuality: {
      type: String,
      enum: ["high-information", "normal", "speculation", "promotional", "spam"],
      default: "normal",
    },

    collectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent storing the same URL twice for the same IPO.
socialPostSchema.index({ ipo: 1, url: 1 }, { unique: true });
socialPostSchema.index({ ipo: 1, publishedAt: -1 });

export default mongoose.model("SocialPost", socialPostSchema);
