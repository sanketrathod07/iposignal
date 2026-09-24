import mongoose from "mongoose";

const watchlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ipo: { type: mongoose.Schema.Types.ObjectId, ref: "Ipo", required: true },
    status: {
      type: String,
      enum: [
        "Watching",
        "Interested",
        "Planning to Apply",
        "Applied",
        "Allotted",
        "Not Allotted",
        "Listed",
        "Holding",
        "Exited",
      ],
      default: "Watching",
    },
    notes: String,
    alertRules: {
      gmpChangePct: { type: Number, default: 10 },
      subscriptionCross: { type: Number, default: 5 },
      qibCross: { type: Number, default: 3 },
      rankChangeBy: { type: Number, default: 3 },
      sentimentShift: { type: Boolean, default: true },
      importantNews: { type: Boolean, default: true },
      closingWithin24h: { type: Boolean, default: true },
      allotmentAnnounced: { type: Boolean, default: true },
      listingTomorrow: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

watchlistSchema.index({ user: 1, ipo: 1 }, { unique: true });

export default mongoose.model("Watchlist", watchlistSchema);
