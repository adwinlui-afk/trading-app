const NEWS_KEY = process.env.REACT_APP_NEWS_KEY;

// Predefined list of stocks to scan - no API limits!
const SCAN_LIST = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN',
  'PLTR', 'IONQ', 'SOUN', 'RXRX', 'CRSP', 'HIMS', 'SHOP', 'LSPD',
  'MSTR', 'COIN', 'HOOD', 'SOFI', 'UPST', 'AFRM', 'RBLX', 'U',
  'ARKG', 'ARKK', 'SOXL', 'TQQQ', 'SPXL', 'NAIL',
];

// Get prices from Yahoo Finance via our serverless function
async function getYahooPrice(ticker) {
  try {
    const res = await fetch(`/api/get-price?ticker=${ticker}`);
    const data = await res.json();
    if (data.error) return null;
    return {
      ticker,
      price: data.price,
      change: data.change,
      volume: data.volume,
      type: 'gainer',
    };
  } catch (e) {
    return null;
  }
}

// Scan all stocks and find top movers
export async function getTopMovers() {
  try {
    console.log('📡 Scanning with Yahoo Finance...');
    const results = await Promise.all(SCAN_LIST.map(t => getYahooPrice(t)));
    const valid = results.filter(Boolean);
    
    // Sort by absolute % change to find top movers
    const sorted = valid.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    
    // Tag gainers vs actives
    return sorted.map(s => ({
      ...s,
      type: s.change > 0 ? 'gainer' : 'active',
      volume: s.volume ? s.volume.toLocaleString() : '0',
    }));
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
    return (
      price >= 0.10 &&
      price <= 500 &&
      volume >= 100000 &&
      change >= 1 &&
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

// Get news-driven stocks using NewsAPI
export async function getNewsDrivenStocks() {
  try {
    const url = `https://newsapi.org/v2/everything?q=stock+earnings+FDA+merger+acquisition&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.articles) return [];

    const tickers = new Set();
    const stocks = [];

    for (const article of data.articles) {
      const text = `${article.title} ${article.description || ''}`;
      const matches = text.match(/\b([A-Z]{2,5})\b/g) || [];
      for (const match of matches) {
        if (!tickers.has(match) && match.length <= 5 && SCAN_LIST.includes(match)) {
          tickers.add(match);
          stocks.push({
            ticker: match,
            sentimentScore: 0.5,
            newsHeadline: article.title,
            source: article.source.name,
          });
        }
      }
    }
    return stocks.slice(0, 10);
  } catch (e) {
    console.error('News scanner error:', e);
    return [];
  }
}

// Main scan function
export async function runDailyScan() {
  console.log('🔍 Running daily stock scan with Yahoo Finance...');

  const [movers, newsStocks] = await Promise.all([
    getTopMovers(),
    getNewsDrivenStocks(),
  ]);

  const swingCandidates = filterSwingCandidates(movers);
  const baggerCandidates = filter100BaggerCandidates(movers);

  const newsTickersWithPrice = newsStocks
    .filter(n => n.sentimentScore > 0.2)
    .map(n => ({ ticker: n.ticker, price: 0, change: 0, volume: '0', newsHeadline: n.newsHeadline, type: 'news' }));

  const allSwingCandidates = [...swingCandidates, ...newsTickersWithPrice].slice(0, 10);

  console.log(`✅ Found ${swingCandidates.length} swing candidates, ${baggerCandidates.length} 100-bagger candidates`);

  return {
    swingCandidates: allSwingCandidates,
    baggerCandidates: baggerCandidates.slice(0, 10),
    newsStocks: newsStocks.slice(0, 5),
    scannedAt: new Date().toISOString(),
  };
}