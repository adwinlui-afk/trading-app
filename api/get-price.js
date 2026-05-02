import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  const { ticker } = req.query;
  
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker required' });
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      price: quote.regularMarketPrice,
      change: quote.regularMarketChangePercent,
      volume: quote.regularMarketVolume,
      prevClose: quote.regularMarketPreviousClose,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}