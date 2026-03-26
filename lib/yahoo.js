const yahooFinance = require("yahoo-finance2");

/**
 * Fetches current quote data for a single ticker.
 * Returns price, weekly change, 52-week range, and volume context.
 */
async function fetchOne(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);

    const currentPrice = quote.regularMarketPrice ?? 0;
    const previousClose = quote.regularMarketPreviousClose ?? 0;
    const weekOpen = quote.regularMarketOpen ?? previousClose;
    const high52 = quote.fiftyTwoWeekHigh ?? 0;
    const low52 = quote.fiftyTwoWeekLow ?? 0;
    const avgVolume = quote.averageDailyVolume10Day ?? 0;
    const latestVolume = quote.regularMarketVolume ?? 0;

    return {
      ticker,
      currentPrice,
      previousClose,
      weekOpen,
      weekChangePercent:
        weekOpen > 0 ? ((currentPrice - weekOpen) / weekOpen) * 100 : 0,
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow: low52,
      percentFromHigh:
        high52 > 0 ? ((currentPrice - high52) / high52) * 100 : 0,
      percentFromLow:
        low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0,
      avgVolume,
      latestVolume,
      volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 0,
      marketCap: quote.marketCap ?? 0,
      name: quote.shortName || quote.longName || ticker,
    };
  } catch (err) {
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
      error: err.message || "Unknown error",
    };
  }
}

/**
 * Fetches prices for all tickers in parallel.
 */
async function fetchAllPrices(tickers) {
  return Promise.all(tickers.map(fetchOne));
}

module.exports = { fetchAllPrices };
