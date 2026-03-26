import yahooFinance from "yahoo-finance2";

export interface PriceData {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  weekOpen: number;
  weekChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  percentFromHigh: number;
  percentFromLow: number;
  avgVolume: number;
  latestVolume: number;
  volumeRatio: number;
  marketCap: number;
  name: string;
  error?: string;
}

/**
 * Fetches current quote data for a single ticker.
 * Returns price, weekly change, 52-week range, and volume context.
 */
async function fetchOne(ticker: string): Promise<PriceData> {
  try {
    const quote = await yahooFinance.quote(ticker);

    const currentPrice = quote.regularMarketPrice ?? 0;
    const previousClose = quote.regularMarketPreviousClose ?? 0;
    const weekOpen = quote.regularMarketOpen ?? previousClose;
    const high52 = quote.fiftyTwoWeekHigh ?? 0;
    const low52 = quote.fiftyTwoWeekLow ?? 0;
    const avgVolume = quote.averageDailyVolume10Day ?? 0;
    const latestVolume = quote.regularMarketVolume ?? 0;

    // Weekly change: compare current to 5-day-ago close
    // quote doesn't give us weekly open directly, so we'll use the
    // historical endpoint for a more accurate weekly figure
    let weekChangePercent = 0;
    try {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const history = await yahooFinance.historical(ticker, {
        period1: weekAgo,
        period2: now,
        interval: "1d",
      });

      if (history.length > 0) {
        const oldestClose = history[0].close ?? currentPrice;
        weekChangePercent = ((currentPrice - oldestClose) / oldestClose) * 100;
      }
    } catch {
      // Fallback: just use previous close for 1-day change
      weekChangePercent =
        previousClose > 0
          ? ((currentPrice - previousClose) / previousClose) * 100
          : 0;
    }

    return {
      ticker,
      currentPrice,
      previousClose,
      weekOpen,
      weekChangePercent,
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow: low52,
      percentFromHigh: high52 > 0 ? ((currentPrice - high52) / high52) * 100 : 0,
      percentFromLow: low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0,
      avgVolume,
      latestVolume,
      volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 1,
      marketCap: quote.marketCap ?? 0,
      name: quote.shortName ?? quote.longName ?? ticker,
    };
  } catch (err: any) {
    return {
      ticker,
      currentPrice: 0,
      previousClose: 0,
      weekOpen: 0,
      weekChangePercent: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      percentFromHigh: 0,
      percentFromLow: 0,
      avgVolume: 0,
      latestVolume: 0,
      volumeRatio: 0,
      marketCap: 0,
      name: ticker,
      error: err.message || "Failed to fetch",
    };
  }
}

/**
 * Fetches price data for all tickers, batched with a small delay
 * to avoid rate limiting.
 */
export async function fetchAllPrices(tickers: string[]): Promise<PriceData[]> {
  const results: PriceData[] = [];

  for (const ticker of tickers) {
    const data = await fetchOne(ticker);
    results.push(data);
    // Small delay to be polite to Yahoo's API
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}
