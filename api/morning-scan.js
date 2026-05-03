export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const appUrl = process.env.APP_URL || 'https://trading-app-nine-alpha.vercel.app';

  async function sendTelegram(text) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  }

  try {
    await sendTelegram(`🌅 <b>GOOD MORNING — AI TRADING SCAN</b>\n\n⏰ 6:30 AM PST\n📊 Scanning 24 stocks for today's best opportunities...`);

    const scanRes = await fetch(`${appUrl}/api/scan`);
    const scanData = await scanRes.json();
    const stocks = scanData.stocks || [];

    const gainers = stocks
      .filter(s => s.change > 0 && s.price > 0.50)
      .sort((a, b) => b.change - a.change)
      .slice(0, 3);

    if (gainers.length === 0) {
      await sendTelegram(`📊 <b>Scan complete!</b>\n\nNo positive movers found this morning. Market may be flat or pre-market.\n\nCheck signals manually:\n${appUrl}`);
      return res.status(200).json({ success: true });
    }

    // $1,000 balance, 25% per trade, $9.95 BMO fee
    const BALANCE = 1000;
    const FEE = 9.95;
    const POSITION_AMOUNT = BALANCE * 0.25;

    let message = `📈 <b>TODAY'S TOP BUY CANDIDATES</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    gainers.forEach((stock, i) => {
      const shares = Math.floor((POSITION_AMOUNT - FEE) / stock.price);
      if (shares < 1) {
        message += `${i + 1}. <b>${stock.ticker}</b> · $${stock.price.toFixed(2)} (+${stock.change}%)\n`;
        message += `   ⚠️ Price too high for $250 position\n\n`;
        return;
      }
      const totalCost = (shares * stock.price) + FEE;
      const remaining = parseFloat((BALANCE - totalCost).toFixed(2));

      message += `${i + 1}. <b>${stock.ticker}</b> · $${stock.price.toFixed(2)} <b>(+${stock.change}%)</b>\n`;
      message += `   📦 Buy <b>${shares} shares</b>\n`;
      message += `   💵 Cost: <b>$${totalCost.toFixed(2)}</b> (incl. $${FEE} fee)\n`;
      message += `   🏦 Balance after: <b>$${remaining}</b>\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `⚠️ <i>Always check the chart before entering.</i>\n`;
    message += `<i>Not financial advice. Paper trade only.</i>\n\n`;
    message += `<a href="${appUrl}">Open app for full AI signal analysis →</a>`;

    await sendTelegram(message);
    return res.status(200).json({ success: true, gainers: gainers.length });

  } catch (e) {
    console.error('Morning scan error:', e);
    try {
      await sendTelegram(`⚠️ Morning scan error: ${e.message}`);
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
