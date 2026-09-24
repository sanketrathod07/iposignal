import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ipo: { type: mongoose.Schema.Types.ObjectId, ref: "Ipo" },
    priority: { type: String, enum: ["critical", "important", "normal"], default: "normal" },
    category: {
      type: String,
      enum: [
        "gmp_change",
        "subscription_update",
        "rank_change",
        "status_change",
        "news",
        "allotment",
        "listing",
        "application",
        "system",
      ],
      default: "system",
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
