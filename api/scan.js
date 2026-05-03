import yahooFinance from 'yahoo-finance2';

const SCAN_LIST = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN',
  'PLTR', 'IONQ', 'SOUN', 'RXRX', 'CRSP', 'HIMS', 'SHOP', 'LSPD',
  'MSTR', 'COIN', 'HOOD', 'SOFI', 'UPST', 'AFRM', 'RBLX', 'U',
  'ARKG', 'ARKK', 'SOXL', 'TQQQ', 'SPXL', 'NAIL',
];

export default async function handler(req, res) {
  try {
    const results = await Promise.all(
      SCAN_LIST.map(async (ticker) => {
        try {
          const quote = await yahooFinance.quote(ticker);
          return {
            ticker,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            type: quote.regularMarketChangePercent > 0 ? 'gainer' : 'active',
          };
        } catch (e) {
          return null;
        }
      })
    );

    const valid = results
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return res.status(200).json({ stocks: valid });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}