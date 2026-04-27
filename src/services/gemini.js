import { getStockNews } from './news';

const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    }
  );
  const data = await response.json();
  console.log('Gemini response:', data);
  if (!data.candidates || !data.candidates[0]) {
    console.error('Gemini error:', data);
    throw new Error('No response from Gemini');
  }
  const text = data.candidates[0].content.parts[0].text;
  return text.replace(/```json|```/g, '').trim();
}

export async function analyzeScannedStocks(stocks) {
  const results = [];
  for (const stock of stocks) {
    try {
      await delay(4000);
      const newsData = await getStockNews(stock.ticker);
      const newsSection = newsData.headlines.length > 0
        ? `Recent News:\n${newsData.headlines}`
        : stock.newsHeadline
        ? `Breaking News: ${stock.newsHeadline}`
        : 'No recent news available.';

      const prompt = `You are an expert swing trader. This stock was flagged by our scanner as a potential opportunity today.

Stock: ${stock.ticker}
Current Price: ${stock.price > 0 ? `$${stock.price}` : 'Fetch current price'}
24h Change: ${stock.change !== 0 ? `${stock.change}%` : 'Unknown'}
Volume: ${stock.volume || 'Unknown'}
Scanner Flag: ${stock.type === 'gainer' ? 'Top Gainer Today' : stock.type === 'active' ? 'Most Actively Traded' : 'News Driven'}

${newsSection}

Rules:
- If volume is under 10000 shares action must be AVOID
- If news is very negative lower confidence
- If news is very positive increase confidence  
- Only recommend stocks tradeable on NYSE NASDAQ TSX or TSX-V on BMO InvestorLine
- Consider momentum news and technical factors
- Be aggressive — we are looking for 10-30% swing trades

Respond ONLY in this exact JSON format no other text no markdown:
{"action":"BUY","confidence":75,"entry":${stock.price > 0 ? stock.price : 10},"target":${stock.price > 0 ? (stock.price*1.20).toFixed(2) : 12},"stop":${stock.price > 0 ? (stock.price*0.85).toFixed(2) : 8.5},"reasoning":"one sentence mentioning why scanner flagged it and news","agreement":"3/3","risk":"Medium","dataFresh":"Live","newsSentiment":"Bullish"}`;

      const text = await callGemini(prompt);
      const signal = JSON.parse(text);
      results.push({ ...signal, ticker: stock.ticker, scannerFlag: stock.type || 'news' });
    } catch (e) {
      console.error(`Error analyzing ${stock.ticker}:`, e);
    }
  }
  return results;
}

export async function analyzeAllStocks(stocks) {
  const results = [];
  for (const stock of stocks) {
    try {
      await delay(4000);
      const newsData = await getStockNews(stock.ticker);
      const newsSection = newsData.headlines.length > 0
        ? `Recent News Headlines:\n${newsData.headlines}`
        : 'No recent news available.';

      const prompt = `You are an expert swing trader analyzing US and Canadian stocks. Analyze this stock and give a trading signal.

Stock: ${stock.ticker}
Current Price: $${stock.price}
24h Change: ${stock.change}%
Volume: ${stock.volume}

${newsSection}

Rules:
- If volume is under 10000 shares action must be AVOID
- If news is very negative lower confidence
- If news is very positive increase confidence
- Only recommend stocks tradeable on NYSE NASDAQ TSX or TSX-V
- Consider both technical and news sentiment

Respond ONLY in this exact JSON format no other text no markdown:
{"action":"BUY","confidence":75,"entry":${stock.price},"target":${(stock.price*1.15).toFixed(2)},"stop":${(stock.price*0.82).toFixed(2)},"reasoning":"one sentence explanation mentioning news if relevant","agreement":"3/3","risk":"Medium","dataFresh":"Live","newsSentiment":"Bullish"}`;

      const text = await callGemini(prompt);
      const signal = JSON.parse(text);
      results.push({ ...signal, ticker: stock.ticker });
    } catch (e) {
      console.error(`Error analyzing ${stock.ticker}:`, e);
    }
  }
  return results;
}

export async function findBaggers(tickers) {
  const prompt = `You are a long-term growth investor combining Joel Greenblatt's Magic Formula with modern growth analysis to find 100-bagger stocks on US and Canadian markets (NYSE, NASDAQ, TSX, TSX-V).

Analyze these stocks: ${tickers.join(', ')}

Score each stock using these 10 criteria:

GREENBLATT MAGIC FORMULA (40% of score):
1. Return on Capital (ROC)
2. Earnings Yield

GROWTH & MOMENTUM KPIs (60% of score):
3. Revenue growth rate
4. Earnings per share growth
5. Debt-to-equity ratio
6. Profit margins
7. Insider buying activity
8. Analyst upgrades
9. Technical breakouts
10. Relative strength vs market

Respond ONLY in this exact JSON format no markdown no other text:
[{"ticker":"IONQ","sector":"Quantum Computing","score":94,"timeframe":"5-10 years","upside":"2400%","reasoning":"one sentence combining Magic Formula and growth factors","magicFormula":{"returnOnCapital":8,"earningsYield":6,"rocRank":"Top 20%","eyRank":"Top 30%"}}]`;

  const text = await callGemini(prompt);
  return JSON.parse(text);
}

export async function findBaggersFromScan(scannedStocks) {
  if (scannedStocks.length === 0) return [];
  
  const tickers = scannedStocks.map(s => s.ticker).join(', ');
  
  const prompt = `You are a long-term growth investor using Greenblatt's Magic Formula to find 100-bagger stocks.

These stocks were flagged by our scanner as potential high-growth candidates today:
${tickers}

Score each for 100x potential using:
- Return on Capital (ROC)
- Earnings Yield
- Revenue growth
- Market position
- Sector tailwinds

Only include stocks available on BMO InvestorLine (NYSE, NASDAQ, TSX, TSX-V).

Respond ONLY in this exact JSON format:
[{"ticker":"SYMBOL","sector":"sector name","score":85,"timeframe":"3-5 years","upside":"500%","reasoning":"one sentence","magicFormula":{"returnOnCapital":7,"earningsYield":5,"rocRank":"Top 30%","eyRank":"Top 40%"}}]`;

  const text = await callGemini(prompt);
  return JSON.parse(text);
}