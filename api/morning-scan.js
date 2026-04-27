export default async function handler(req, res) {
  // Security check - only allow Vercel cron calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Send morning briefing opening message
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🌅 <b>GOOD MORNING — AI TRADING SCAN</b>\n\n⏰ 6:30 AM PST\n📊 Scanning market for today's best opportunities...\n\n<i>Results coming in a moment...</i>`,
        parse_mode: 'HTML'
      })
    });

    // Trigger the main app scan via fetch
    const appUrl = process.env.APP_URL || 'https://trading-app-six-iota.vercel.app';
    
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ <b>Morning scan complete!</b>\n\nOpen the app to see today's signals:\n${appUrl}`,
        parse_mode: 'HTML'
      })
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Morning scan error:', e);
    return res.status(500).json({ error: e.message });
  }
}