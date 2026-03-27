/**
 * Fetches quote data directly from Yahoo Finance API.
 * No yahoo-finance2 dependency — just fetch.
 */
async function fetchOne(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No data returned");

    const meta = result.meta || {};
    const currentPrice = meta.regularMarketPrice ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const high52 = meta.fiftyTwoWeekHigh ?? 0;
    const low52 = meta.fiftyTwoWeekLow ?? 0;

    // Get first open of the week from the chart data
    const opens = result.indicators?.quote?.[0]?.open || [];
    const weekOpen = opens.find((v) => v != null) ?? previousClose;

    // Volume from the latest trading day
    const volumes = result.indicators?.quote?.[0]?.volume || [];
    const latestVolume = volumes.filter((v) => v != null).pop() ?? 0;

    // 10-day avg volume from a separate quote endpoint
    let avgVolume = 0;
    let marketCap = 0;
    let name = ticker;
    try {
      const quoteUrl = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(ticker)}`;
      const quoteResp = await fetch(quoteUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (quoteResp.ok) {
        const quoteData = await quoteResp.json();
        const q = quoteData.quoteResponse?.result?.[0];
        if (q) {
          avgVolume = q.averageDailyVolume10Day ?? 0;
          marketCap = q.marketCap ?? 0;
          name = q.shortName || q.longName || ticker;
        }
      }
    } catch (_) {
      // Non-critical — proceed without extra quote data
    }

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
      marketCap,
      name,
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
