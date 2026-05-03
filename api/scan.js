export default async function handler(req, res) {
  const SCAN_LIST = [
    'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'PLTR', 'IONQ',
    'SOUN', 'RXRX', 'CRSP', 'HIMS', 'SHOP', 'COIN', 'HOOD', 'SOFI',
    'UPST', 'AFRM', 'RBLX', 'MSTR', 'ARKG', 'ARKK', 'GOOGL', 'AMZN',
  ];

  try {
    const tickers = SCAN_LIST.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });
    
    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    
    const stocks = quotes
      .filter(q => q.regularMarketPrice)
      .map(q => ({
        ticker: q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        type: q.regularMarketChangePercent > 0 ? 'gainer' : 'active',
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return res.status(200).json({ stocks });
  } catch (e) {
    return res.status(500).json({ error: e.message, stocks: [] });
  }
}