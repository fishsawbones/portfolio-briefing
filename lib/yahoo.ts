// eslint-disable-next-line @typescript-eslint/no-var-requires
const yahooFinance = require("yahoo-finance2");

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

