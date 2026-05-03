export default async function handler(req, res) {
  const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
  
  const SCAN_LIST = [
    'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'PLTR', 'IONQ',
    'SOUN', 'RXRX', 'CRSP', 'HIMS', 'SHOP', 'COIN', 'HOOD', 'SOFI',
    'UPST', 'AFRM', 'RBLX', 'MSTR', 'ARKG', 'ARKK', 'GOOGL', 'AMZN',
  ];

  try {
    const results = await Promise.all(
      SCAN_LIST.map(async (ticker) => {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`
          );
          const data = await res.json();
          if (!data.c) return null;
          const change = ((data.c - data.pc) / data.pc) * 100;
          return {
            ticker,
            price: data.c,
            change: parseFloat(change.toFixed(2)),
            volume: data.v || 0,
            type: change > 0 ? 'gainer' : 'active',
          };
        } catch (e) {
          return null;
        }
      })
    );

    const stocks = results
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return res.status(200).json({ stocks });
  } catch (e) {
    return res.status(500).json({ error: e.message, stocks: [] });
  }
}