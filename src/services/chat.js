const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;

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
  if (!data.candidates || !data.candidates[0]) throw new Error('No response');
  return data.candidates[0].content.parts[0].text;
}

function isTradingModeQuestion(question) {
  const q = question.toLowerCase();
  return (
    q.includes('buy') || q.includes('which stock') || q.includes('what should i') ||
    q.includes('recommend') || q.includes('best stock') || q.includes('opportunity') ||
    q.includes('portfolio') || q.includes('how am i doing') || q.includes('win rate') ||
    q.includes('p&l') || q.includes('profit') || q.includes('loss') || q.includes('close') ||
    q.includes('sell') || q.includes('exit') || q.includes('trade') || q.includes('milestone') ||
    q.includes('on track') || q.includes('fees') || q.includes('balance')
  );
}

export async function askStockQuestion(question, portfolioContext) {
  const isTrading = isTradingModeQuestion(question);

  let prompt;

  if (isTrading) {
    prompt = `You are an AI trading coach for a Canadian retail investor. You have full access to their portfolio and today's market scan.

${portfolioContext}

TRADING COACH RULES:
1. For "which stock should I buy" — recommend the highest confidence BUY signal from TODAY'S TOP SIGNALS with exact share count based on their balance and fee
2. Always calculate: shares = floor((balance * 0.25 - fee) / price), show total cost and remaining balance
3. Warn if they already have 2+ open trades at this balance level
4. Only recommend stocks with 70%+ confidence
5. Always say "verify the chart before entering" 
6. For portfolio questions — give specific numbers from their data
7. For "should I close" questions — compare current price to entry and target
8. Be direct and specific — give a clear recommendation with numbers
9. End with a one-line risk reminder
10. Keep response under 150 words

User question: ${question}

Give a specific, data-driven response:`;
  } else {
    prompt = `You are a factual stock market assistant for a Canadian retail investor using BMO InvestorLine.

STRICT RULES:
1. Only state FACTS — never speculate or predict prices
2. If you don't know something, say "I don't have reliable data on that"
3. Always mention that past performance doesn't guarantee future results
4. Keep answers concise — 2-4 sentences max
5. For Canadian investors: mention TSX alternatives when relevant
6. Never say "you should buy" or "you should sell" — only provide facts
7. Always caveat with "this is not financial advice"

User's portfolio context:
${portfolioContext}

User question: ${question}

Answer factually and concisely:`;
  }

  const response = await callGemini(prompt);
  return response;
}