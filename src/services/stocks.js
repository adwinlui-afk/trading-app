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
    const response = await fetch(`/api/get-price?ticker=${ticker}`);
    const data = await response.json();
    if (data.error) return null;
    
    const volume = data.volume;
    const formattedVolume = volume >= 1000000 
      ? `${(volume/1000000).toFixed(1)}M`
      : volume >= 1000 
      ? `${(volume/1000).toFixed(0)}K` 
      : `${volume}`;

    return {
      ticker,
      price: parseFloat(data.price.toFixed(2)),
      change: parseFloat(data.change.toFixed(2)),
      volume: formattedVolume,
      prevClose: parseFloat(data.prevClose.toFixed(2)),
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
  console.log('📡 Fetching fresh prices from Yahoo Finance...');
  const results = [];
  for (const ticker of tickers) {
    const data = await getStockPrice(ticker);
    if (data) results.push(data);
    else console.warn(`Skipping ${ticker} — no price data available`);
  }
  if (results.length > 0) setCache(results);
  return results;
}