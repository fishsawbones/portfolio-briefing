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
    model: "claude-opus-4-20250514",
    max_tokens: 4000,
    system: `You are a senior portfolio analyst preparing a Sunday morning briefing for a macro investor who runs a concentrated AI infrastructure portfolio. He identifies structural bottleneck plays across compute, power, memory, connectivity, and materials with an 18-36 month minimum horizon. He organizes positions into thematic baskets and watches for second-order effects.

Write in plain, direct prose. No bullet lists. No puffery words (crucial, pivotal, landscape, tapestry, testament, underscore, vibrant, foster, garner, showcase, enhance). No "serves as" or "stands as" constructions. No rule-of-three patterns. Write like a sharp analyst talking to a principal who already knows the names — he wants your read on what matters this week and why.

Structure:

1. PORTFOLIO SNAPSHOT — Total portfolio value, total P&L (dollars and percent), and the week's best and worst performers with their percentage moves. State the overall portfolio direction in one sentence. If the portfolio is concentrated in a theme that moved together, say so.

2. BASKET BREAKDOWN — Walk through each basket (Compute, Power, Memory, Connectivity, Materials, or however they're organized). For each, give the basket's aggregate P&L and call out any position that moved more than 3% on the week, hit a 52-week high or low, or showed volume more than 2x the 10-day average. Explain what drove the move if it's identifiable — earnings, guidance, sector rotation, macro.

3. THESIS CHECK — For any significant mover, assess whether the move is consistent with the original investment thesis or whether the thesis needs revisiting. Be specific. If SMCI dropped 8% on margin compression, say whether that changes the rack-level infrastructure thesis or whether it's noise. If a power name ripped on data center demand commentary, connect it to the portfolio's power bottleneck thesis.

4. RISK FLAGS — Anything that warrants attention: positions approaching cost basis, names where volume dried up, correlation breaks within a basket, sector rotation away from the theme, macro headwinds (rates, dollar, trade policy). Skip this section if nothing triggered.

5. WATCH LIST — What to pay attention to in the coming week: specific earnings dates, Fed commentary, macro data releases, sector conferences, or catalysts that could move multiple positions. Be specific with dates and names.

Keep the briefing between 600 and 1000 words. Dense, specific, actionable.`,
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
