// @ts-nocheck
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchPositions } from "../lib/sheets";
import { fetchAllPrices } from "../lib/yahoo";
import { enrichPositions, generateBriefing } from "../lib/claude";
import { sendBriefingEmail } from "../lib/email";

/**
 * /api/briefing
 *
 * Triggered by Vercel cron every Sunday at 11:00 UTC (6:00 AM CDT).
 * Can also be triggered manually via GET request for testing.
 *
 * Flow:
 *   1. Read positions from Google Sheet
 *   2. Fetch current prices from Yahoo Finance
 *   3. Enrich positions with P&L calculations
 *   4. Generate narrative briefing via Claude
 *   5. Email the briefing via Resend
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret for automated calls
  // Manual calls with ?test=true skip this check in development
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

    // Step 1: Read positions
    console.log("[briefing] Fetching positions from Google Sheet...");
    const positions = await fetchPositions();
    console.log(`[briefing] Found ${positions.length} positions`);

    if (positions.length === 0) {
      return res.status(200).json({
        status: "skipped",
        reason: "No positions found in sheet",
      });
    }

    // Step 2: Fetch prices
    console.log("[briefing] Fetching prices from Yahoo Finance...");
    const tickers = positions.map((p) => p.ticker);
    const prices = await fetchAllPrices(tickers);

    const errors = prices.filter((p) => p.error);
    if (errors.length > 0) {
      console.warn(
        `[briefing] Price fetch errors: ${errors.map((e) => `${e.ticker}: ${e.error}`).join(", ")}`
      );
    }

    // Step 3: Enrich with P&L
    console.log("[briefing] Computing portfolio metrics...");
    const enriched = enrichPositions(positions, prices);

    // Step 4: Generate narrative
    console.log("[briefing] Generating briefing via Claude...");
    const briefing = await generateBriefing(enriched);

    // Step 5: Send email
    console.log("[briefing] Sending email...");
    await sendBriefingEmail(briefing);

    console.log("[briefing] Complete.");

    // Return the briefing in the response too (useful for testing)
    return res.status(200).json({
      status: "sent",
      positions: positions.length,
      priceErrors: errors.length,
      briefingLength: briefing.length,
      // Include briefing text only in test mode
      ...(isTest && { briefing }),
    });
  } catch (err: any) {
    console.error("[briefing] Fatal error:", err);
    return res.status(500).json({
      status: "error",
      message: err.message || "Unknown error",
    });
  }
}
