/**
 * Merges position data with price data and computes P&L.
 */
function enrichPositions(positions, prices) {
  const priceMap = new Map(prices.map((p) => [p.ticker, p]));

  return positions.map((pos) => {
    const price = priceMap.get(pos.ticker) || {
      ticker: pos.ticker,
      currentPrice: 0,
      error: "No price data",
    };

    const currentValue = pos.shares * price.currentPrice;
    const costBasis = pos.shares * pos.entryPrice;
    const gainLossDollar = currentValue - costBasis;
    const gainLossPercent =
      costBasis > 0 ? (gainLossDollar / costBasis) * 100 : 0;

    return {
      ...pos,
      price,
      currentValue,
      gainLossPercent,
      gainLossDollar,
    };
  });
}

/**
 * Formats enriched positions into a data block for Claude.
 */
function formatDataForPrompt(positions) {
  const byBasket = new Map();
  for (const pos of positions) {
    const basket = pos.basket;
    if (!byBasket.has(basket)) byBasket.set(basket, []);
    byBasket.get(basket).push(pos);
  }

  let output = "";
  let totalValue = 0;
  let totalCost = 0;

  for (const [basket, basketPositions] of byBasket) {
    output += `\n=== ${basket} ===\n`;
    for (const p of basketPositions) {
      const err = p.price.error ? ` [ERROR: ${p.price.error}]` : "";
      output += `${p.ticker} (${p.price.name})\n`;
      output += `  Price: $${p.price.currentPrice.toFixed(2)} | Week: ${p.price.weekChangePercent >= 0 ? "+" : ""}${p.price.weekChangePercent.toFixed(2)}%\n`;
      output += `  52W Range: $${p.price.fiftyTwoWeekLow.toFixed(2)} – $${p.price.fiftyTwoWeekHigh.toFixed(2)} | From High: ${p.price.percentFromHigh.toFixed(1)}% | From Low: +${p.price.percentFromLow.toFixed(1)}%\n`;
      output += `  Volume Ratio: ${p.price.volumeRatio.toFixed(2)}x avg\n`;
      output += `  Position: ${p.shares} shares @ $${p.entryPrice.toFixed(2)} = $${p.currentValue.toFixed(0)} | P&L: ${p.gainLossPercent >= 0 ? "+" : ""}${p.gainLossPercent.toFixed(1)}% ($${p.gainLossDollar >= 0 ? "+" : ""}${p.gainLossDollar.toFixed(0)})${err}\n`;
      if (p.notes) output += `  Notes: ${p.notes}\n`;
      totalValue += p.currentValue;
      totalCost += p.shares * p.entryPrice;
    }
  }

  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  output += `\n=== PORTFOLIO TOTALS ===\n`;
  output += `Total Value: $${totalValue.toFixed(0)}\n`;
  output += `Total Cost Basis: $${totalCost.toFixed(0)}\n`;
  output += `Total P&L: ${totalGLPct >= 0 ? "+" : ""}${totalGLPct.toFixed(1)}% ($${totalGL >= 0 ? "+" : ""}${totalGL.toFixed(0)})\n`;

  return output;
}

/**
 * Calls Claude to generate the narrative briefing.
 */
async function generateBriefing(positions) {
  const AnthropicModule = await import("@anthropic-ai/sdk");
  const Anthropic = AnthropicModule.default || AnthropicModule;
  const client = new Anthropic();

  const dataBlock = formatDataForPrompt(positions);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are a portfolio analyst preparing a Sunday morning briefing for a macro investor. The reader focuses on structural bottleneck plays in AI infrastructure with an 18–36 month horizon. He organizes positions into thematic baskets.

Write the briefing in plain, direct prose. No bullet lists. No puffery words (crucial, pivotal, landscape, tapestry, testament, underscore, vibrant, foster, garner, showcase, enhance). No "serves as" or "stands as" constructions.

Structure:
1. PORTFOLIO SNAPSHOT — Total value, total P&L, best and worst performers this week. Two to three sentences.
2. SIGNALS — Any position that moved more than 3% on the week, hit a new 52-week high or low, or showed volume more than 2x the 10-day average. Explain what happened if the move is notable. Skip this section entirely if nothing triggered.
3. THESIS CHECK — For any significant mover, one sentence on whether the move is consistent with the original investment thesis or warrants review.
4. WATCH LIST — One to two sentences on what to pay attention to this coming week (earnings, macro events, sector catalysts).

Keep the entire briefing under 600 words. The reader wants density, not length.`,
    messages: [
      {
        role: "user",
        content: `Generate the portfolio briefing for ${today}.\n\nPORTFOLIO DATA:\n${dataBlock}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text || "Failed to generate briefing.";
}

module.exports = { enrichPositions, generateBriefing };
