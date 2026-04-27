export async function sendTelegramAlert(message) {
  try {
    await fetch('/api/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  } catch (e) {
    console.error('Telegram alert failed:', e);
  }
}