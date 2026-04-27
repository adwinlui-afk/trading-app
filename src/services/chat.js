const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const ALPHA_KEY = process.env.REACT_APP_ALPHA_KEY;

async function callGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );
  const data = await response.json();
  if (!data.candidates || !data.candidates[0]) throw new Error('No response');
  return data.candidates[0].content.parts[0].text;
}

async function getStockContext(ticker) {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) return null;
    return {
      price: parseFloat(quote['05. price']),
      change: quote['10. change percent'],
      volume: quote['06. volume'],
      high: quote['03. high'],
      low: quote['04. low'],
    };
  } catch (e) { return null; }
}

export async function askStockQuestion(question, portfolioContext) {
  // Extract any ticker mentioned in the question
  const tickerMatch = question.match(/\b[A-Z]{1,5}\b/g);
  const tickers = tickerMatch ? tickerMatch.filter(t => t.length >= 2 && t.length <= 5) : [];

  let priceContext = '';
  if (tickers.length > 0) {
    const priceData = await getStockContext(tickers[0]);
    if (priceData) {
      priceContext = `
Current market data for ${tickers[0]}:
- Price: $${priceData.price}
- Change: ${priceData.change}
- Volume: ${priceData.volume}
- Day High: $${priceData.high}
- Day Low: $${priceData.low}
`;
    }
  }

  const prompt = `You are a factual stock market assistant for a Canadian retail investor using BMO InvestorLine.

STRICT RULES:
1. Only state FACTS — never speculate or predict prices
2. If you don't know something, say "I don't have reliable data on that"
3. Always mention that past performance doesn't guarantee future results
4. Keep answers concise — 2-4 sentences max
5. For Canadian investors: mention TSX alternatives when relevant
6. Never say "you should buy" or "you should sell" — only provide facts
7. If asked about price targets, give analyst consensus ranges only
8. Always caveat with "this is not financial advice"

User's portfolio context:
${portfolioContext}

${priceContext}

User question: ${question}

Answer factually and concisely:`;

  const response = await callGemini(prompt);
  return response;
}