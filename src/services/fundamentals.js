const ALPHA_KEY = process.env.REACT_APP_ALPHA_KEY;

export async function getCompanyOverview(ticker) {
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.Symbol) return null;

    return {
      ticker,
      name: data.Name,
      sector: data.Sector,
      industry: data.Industry,
      marketCap: parseFloat(data.MarketCapitalization) || 0,
      peRatio: parseFloat(data.PERatio) || null,
      revenueGrowthYOY: parseFloat(data.QuarterlyRevenueGrowthYOY) || null,
      earningsGrowth: parseFloat(data.QuarterlyEarningsGrowthYOY) || null,
      debtToEquity: parseFloat(data.DebtToEquityRatio) || null,
      profitMargin: parseFloat(data.ProfitMargin) || null,
      analystTarget: parseFloat(data.AnalystTargetPrice) || null,
      currentPrice: parseFloat(data['52WeekHigh']) || null,
      week52High: parseFloat(data['52WeekHigh']) || null,
      week52Low: parseFloat(data['52WeekLow']) || null,
      description: data.Description,
    };
  } catch (e) {
    console.error(`Error fetching fundamentals for ${ticker}:`, e);
    return null;
  }
}

export async function getAllFundamentals(tickers) {
  const results = [];
  for (const ticker of tickers) {
    const data = await getCompanyOverview(ticker);
    if (data) results.push(data);
    else console.warn(`Skipping ${ticker} — no fundamental data`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return results;
}