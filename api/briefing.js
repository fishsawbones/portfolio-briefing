const { fetchPositions } = require("../lib/sheets");
const { fetchAllPrices } = require("../lib/yahoo");
const { enrichPositions, generateBriefing } = require("../lib/claude");
const { sendBriefingEmail } = require("../lib/email");

/**
 * /api/briefing
 *
 * Triggered by Vercel cron every Sunday at 11:00 UTC (6:00 AM CDT).
 * Can also be triggered manually via GET request for testing.
 */
module.exports = async function handler(req, res) {
  const isTest = req.query.test === "true";
  const cronSecret = req.headers["authorization"];
  if (
    !isTest &&
    process.env.CRON_SECRET &&
    cronSecret !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[briefing] Starting portfolio briefing generation...");

    console.log("[briefing] Fetching positions from Google Sheet...");
    const positions = await fetchPositions();
    console.log(`[briefing] Found ${positions.length} positions`);

    if (positions.length === 0) {
      return res.status(200).json({
        status: "skipped",
        reason: "No positions found in sheet",
      });
    }

    console.log("[briefing] Fetching prices from Yahoo Finance...");
    const tickers = positions.map((p) => p.ticker);
    const prices = await fetchAllPrices(tickers);
    const errors = prices.filter((p) => p.error);
    if (errors.length > 0) {
      console.warn(
        `[briefing] Price fetch errors: ${errors.map((e) => `${e.ticker}: ${e.error}`).join(", ")}`
      );
    }

    console.log("[briefing] Computing portfolio metrics...");
    const enriched = enrichPositions(positions, prices);

    console.log("[briefing] Generating briefing via Claude...");
    const briefing = await generateBriefing(enriched);

    console.log("[briefing] Sending email...");
    await sendBriefingEmail(briefing);

    console.log("[briefing] Complete.");

    return res.status(200).json({
      status: "sent",
      positions: positions.length,
      priceErrors: errors.length,
      briefingLength: briefing.length,
      ...(isTest && { briefing }),
    });
  } catch (err) {
    console.error("[briefing] Fatal error:", err);
    return res.status(500).json({
      status: "error",
      message: err.message || "Unknown error",
    });
  }
};
