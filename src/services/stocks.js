const ALPHA_KEY = process.env.REACT_APP_ALPHA_KEY;
const CACHE_KEY = 'lui_price_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

function getCached() {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const { data, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > CACHE_DURATION) return null;
    return data;
  } catch (e) { return null; }
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

export async function getStockPrice(ticker) {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) return null;
    const price = parseFloat(quote['05. price']);
    const prevClose = parseFloat(quote['08. previous close']);
    const change = parseFloat(quote['10. change percent'].replace('%', ''));
    const volume = parseInt(quote['06. volume']) || 0;
    const formattedVolume = volume > 1000000 ? `${(volume / 1000000).toFixed(1)}M` : volume > 1000 ? `${(volume / 1000).toFixed(1)}K` : `${volume}`;
    return {
      ticker,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      volume: formattedVolume,
      prevClose: parseFloat(prevClose.toFixed(2)),
    };
  } catch (e) {
    console.error(`Error fetching ${ticker}:`, e);
    return null;
  }
}

export async function getAllPrices(tickers) {
  const cached = getCached();
  if (cached) {
    console.log('✅ Using cached prices (less than 15 mins old)');
    return cached;
  }

  console.log('📡 Fetching fresh prices from Alpha Vantage...');
  const results = [];
  for (const ticker of tickers) {
    const data = await getStockPrice(ticker);
    if (data) results.push(data);
    else console.warn(`Skipping ${ticker} — no price data available`);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  if (results.length > 0) setCache(results);
  return results;
}