const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const NEWS_KEY = process.env.REACT_APP_NEWS_KEY;

export async function getWatchlistNews(ticker) {
  try {
    const url = `https://newsapi.org/v2/everything?q=${ticker}&sortBy=publishedAt&pageSize=3&apiKey=${NEWS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.articles) return [];
    return data.articles.slice(0, 3).map(a => ({
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source.name,
    }));
  } catch (e) { return []; }
}

export async function getWatchlistRecommendation(stock, currentPrice, news) {
  try {
    const priceChange = ((currentPrice - stock.addedPrice) / stock.addedPrice * 100).toFixed(2);
    const newsHeadlines = news.map(n => n.title).join('\n');

    const prompt = `You are an AI trading assistant. Analyze this stock and give a recommendation.

Stock: ${stock.ticker}
Added to watchlist at: $${stock.addedPrice}
Current price: $${currentPrice}
Price change since added: ${priceChange}%
Original signal: ${stock.signal} with ${stock.confidence}% confidence
Target: $${stock.target}
Stop loss: $${stock.stop}

Latest news:
${newsHeadlines}

Give a JSON response only, no markdown:
{
  "recommendation": "BUY NOW" or "WATCH" or "DROP IT",
  "reasoning": "one sentence explanation",
  "confidence": number 0-100
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return { recommendation: 'WATCH', reasoning: 'Unable to analyze at this time', confidence: 50 };
  }
}