import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    rankingModels: [
      {
        name: String,
        weights: {
          fundamentals: { type: Number, default: 25 },
          valuation: { type: Number, default: 15 },
          gmp: { type: Number, default: 15 },
          gmpTrend: { type: Number, default: 5 },
          subscription: { type: Number, default: 15 },
          socialSentiment: { type: Number, default: 10 },
          risk: { type: Number, default: 10 },
          ipoStructure: { type: Number, default: 5 },
        },
        isDefault: { type: Boolean, default: false },
      },
    ],
    alertDefaults: {
      gmpChangePct: { type: Number, default: 10 },
      subscriptionCross: { type: Number, default: 5 },
      qibCross: { type: Number, default: 3 },
      rankChangeBy: { type: Number, default: 3 },
    },
    lastVisitedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

export default mongoose.model("User", userSchema);
