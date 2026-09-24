import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/auth.js";
import ipoRoutes from "./routes/ipos.js";
import watchlistRoutes from "./routes/watchlist.js";
import applicationRoutes from "./routes/applications.js";
import notificationRoutes from "./routes/notifications.js";
import socialRoutes from "./routes/social.js";

const app = express();

app.use(cors({
  origin: [
    process.env.CLIENT_ORIGIN || "http://localhost:5173", 
    "https://iposignal.sanketrathod.in"
  ],
  credentials: true
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "ipo-command-center-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/ipos", ipoRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ipos", socialRoutes); // adds /:slug/social/* endpoints alongside ipoRoutes

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error", detail: err.message });
});

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

  // Ingest live IPOs if database is empty or has only seed data
  try {
    const Ipo = (await import("./models/Ipo.js")).default;
    const count = await Ipo.countDocuments();
    if (count < 10) {
      console.log("Database has low IPO count, running initial live sync...");
      const { ingestLiveIpos } = await import("./services/ipoIngestion.js");
      ingestLiveIpos().catch((e) => console.error("Initial sync error:", e.message));
    }
  } catch (err) {
    console.error("Startup sync check failed:", err.message);
  }

  // Optional: run the daily ranking-snapshot + social-collection job
  // in-process on a schedule, instead of an external cron entry.
  // Set RUN_CRON=true and (optionally) CRON_SCHEDULE in .env to enable.
  if (process.env.RUN_CRON === "true") {
    const cron = await import("node-cron");
    const { runDailyJob } = await import("./scripts/dailySnapshot.js");
    const schedule = process.env.CRON_SCHEDULE || "0 7 * * *"; // default: 7am daily
    cron.default.schedule(schedule, () => {
      console.log("Running scheduled daily job:", new Date().toISOString());
      runDailyJob().catch((err) => console.error("Daily job failed:", err));
    });
    console.log(`Daily job scheduled: "${schedule}"`);
  }
});
