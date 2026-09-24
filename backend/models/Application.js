import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ipo: { type: mongoose.Schema.Types.ObjectId, ref: "Ipo", required: true },
    lots: { type: Number, required: true, default: 1 },
    amountBlocked: Number,
    applicationDate: { type: Date, default: Date.now },
    stage: {
      type: String,
      enum: [
        "Applied",
        "IPO Closed",
        "Basis of Allotment",
        "Allotment Result",
        "Refund",
        "Shares Credited",
        "Listed",
      ],
      default: "Applied",
    },
    allotmentResult: { type: String, enum: ["Pending", "Allotted", "Not Allotted"], default: "Pending" },
    refundAmount: Number,
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
