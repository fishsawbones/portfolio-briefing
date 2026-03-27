const { google } = require("googleapis");

/**
 * Strips currency formatting ($, commas) so parseFloat works.
 */
function parseCurrency(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[\$,]/g, "")) || 0;
}

/**
 * Reads the positions list from your Google Sheet.
 *
 * Expected sheet layout (Sheet1):
 *   A: Ticker    (e.g., NVDA)
 *   B: Basket    (e.g., Compute, Power, Memory, Connectivity)
 *   C: Shares    (number of shares/units)
 *   D: Entry $   (cost basis per share, may have $ and commas)
 *   E: Entry Date (YYYY-MM-DD)
 *   F: Notes     (optional — thesis reminder, etc.)
 *
 * Row 1 is headers, data starts row 2.
 */
async function fetchPositions() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A2:F100",
  });

  const rows = res.data.values || [];

  return rows
    .filter((row) => row[0]?.trim())
    .map((row) => ({
      ticker: row[0]?.trim().toUpperCase(),
      basket: row[1]?.trim() || "Uncategorized",
      shares: parseCurrency(row[2]),
      entryPrice: parseCurrency(row[3]),
      entryDate: row[4]?.trim() || "",
      notes: row[5]?.trim() || "",
    }));
}

module.exports = { fetchPositions };
