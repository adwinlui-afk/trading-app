const ALPHA_KEY = process.env.REACT_APP_ALPHA_KEY;

// Top movers and active stocks from Alpha Vantage
export async function getTopMovers() {
  try {
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const gainers = (data.top_gainers || []).slice(0, 10).map(s => ({
      ticker: s.ticker,
      price: parseFloat(s.price),
      change: parseFloat(s.change_percentage.replace('%', '')),
      volume: s.volume,
      type: 'gainer'
    }));

    const actives = (data.most_actively_traded || []).slice(0, 10).map(s => ({
      ticker: s.ticker,
      price: parseFloat(s.price),
      change: parseFloat(s.change_percentage.replace('%', '')),
      volume: s.volume,
      type: 'active'
    }));

    return [...gainers, ...actives];
  } catch (e) {
    console.error('Scanner error:', e);
    return [];
  }
}

// Filter stocks suitable for swing trading
export function filterSwingCandidates(stocks) {
  return stocks.filter(s => {
    const price = s.price;
    const change = Math.abs(s.change);
    const volume = parseInt(s.volume?.replace(/,/g, '') || '0');

    // Must be:
    // - Price between $0.10 and $500 (available on BMO)
    // - Volume over 500,000 (liquid enough to trade)
    // - Price change over 3% (momentum)
    // - Not a test/invalid ticker
    return (
      price >= 0.10 &&
      price <= 500 &&
      volume >= 500000 &&
      change >= 3 &&
      s.ticker.length <= 5 &&
      !s.ticker.includes('.')
    );
  });
}

// Filter stocks suitable for 100-bagger hunting
export function filter100BaggerCandidates(stocks) {
  return stocks.filter(s => {
    const price = s.price;
    const volume = parseInt(s.volume?.replace(/,/g, '') || '0');

    // 100-bagger candidates:
    // - Small/mid cap (price under $50)
    // - Decent volume (over 100,000)
    // - Positive momentum
    return (
      price >= 0.50 &&
      price <= 50 &&
      volume >= 100000 &&
      s.change > 0 &&
      s.ticker.length <= 5 &&
      !s.ticker.includes('.')
    );
  });
}

// Get news-driven movers
export async function getNewsDrivenStocks() {
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=earnings,ipo,mergers_and_acquisitions&sort=RELEVANCE&limit=20&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.feed) return [];

    const tickers = new Set();
    const stocks = [];

    for (const article of data.feed) {
      for (const ticker of (article.ticker_sentiment || [])) {
        if (
          !tickers.has(ticker.ticker) &&
          parseFloat(ticker.relevance_score) > 0.5 &&
          Math.abs(parseFloat(ticker.ticker_sentiment_score)) > 0.2 &&
          ticker.ticker.length <= 5 &&
          !ticker.ticker.includes('.')
        ) {
          tickers.add(ticker.ticker);
          stocks.push({
            ticker: ticker.ticker,
            sentimentScore: parseFloat(ticker.ticker_sentiment_score),
            relevance: parseFloat(ticker.relevance_score),
            sentiment: ticker.ticker_sentiment_label,
            newsHeadline: article.title,
            source: article.source,
          });
        }
      }
    }

    return stocks.slice(0, 15);
  } catch (e) {
    console.error('News scanner error:', e);
    return [];
  }
}

// Main scan function - runs everything
export async function runDailyScan() {
  console.log('🔍 Running daily stock scan...');

  const [movers, newsStocks] = await Promise.all([
    getTopMovers(),
    getNewsDrivenStocks(),
  ]);

  const swingCandidates = filterSwingCandidates(movers);
  const baggerCandidates = filter100BaggerCandidates(movers);

  // Combine news stocks with movers for swing trading
  const newsTickersWithPrice = newsStocks
    .filter(n => n.sentimentScore > 0.2)
    .map(n => ({ ticker: n.ticker, price: 0, change: 0, volume: '0', newsHeadline: n.newsHeadline }));

  const allSwingCandidates = [...swingCandidates, ...newsTickersWithPrice]
    .slice(0, 8);

  console.log(`✅ Found ${swingCandidates.length} swing candidates, ${baggerCandidates.length} 100-bagger candidates`);

  return {
    swingCandidates: allSwingCandidates,
    baggerCandidates: baggerCandidates.slice(0, 10),
    newsStocks: newsStocks.slice(0, 5),
    scannedAt: new Date().toISOString(),
  };
}