const ALPHA_KEY = process.env.REACT_APP_ALPHA_KEY;

export async function getStockNews(ticker) {
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&limit=5&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.feed || data.feed.length === 0) {
      return { ticker, headlines: [] };
    }

    const headlines = data.feed
      .slice(0, 5)
      .map(a => `${a.title} (${a.source})`)
      .join('\n');

    return { ticker, headlines };
  } catch (e) {
    console.error(`News error for ${ticker}:`, e);
    return { ticker, headlines: [] };
  }
}