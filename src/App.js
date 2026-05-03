import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { analyzeScannedStocks, findBaggersFromScan, findBaggers } from './services/gemini';
import { sendTelegramAlert } from './services/telegram';
import { runDailyScan } from './services/scanner';
import { getTradeFee, isETF, getBaggerSignal } from './utils/tracker';
import { signInWithGoogle, signOutUser, onAuthChange, getBalanceDB, setBalanceDB, getTradesDB, addTradeDB, updateTradeDB, getBaggerPortfolioDB, addBaggerPositionDB, removeBaggerPositionDB, resetAllDB, getSettingsDB, saveSettingsDB } from './services/firebase';
import { askStockQuestion } from './services/chat';
import { getWatchlistDB, addToWatchlistDB, removeFromWatchlistDB } from './services/watchlist';
import { getWatchlistNews, getWatchlistRecommendation } from './services/watchlistAnalyzer';
import StockChart from './components/StockChart';
const FALLBACK_STOCKS = [
  { ticker: 'SOUN', price: 8.19, change: 4.73, volume: '29.0M', type: 'gainer' },
  { ticker: 'CRKN', price: 0.07, change: 0, volume: '120', type: 'active' },
  { ticker: 'IONQ', price: 42.69, change: -2.15, volume: '20.7M', type: 'gainer' },
  { ticker: 'RXRX', price: 3.51, change: -5.9, volume: '9.4M', type: 'active' },
  { ticker: 'ARKG', price: 28.50, change: 1.2, volume: '3.1M', type: 'active' },
];

const PLATFORMS = [
  { name: 'BMO InvestorLine', stockFee: 9.95, etfFee: 0 },
  { name: 'Wealthsimple Trade', stockFee: 0, etfFee: 0 },
  { name: 'Questrade', stockFee: 4.95, etfFee: 0 },
  { name: 'TD Direct Investing', stockFee: 9.99, etfFee: 9.99 },
  { name: 'CIBC Investor\'s Edge', stockFee: 6.95, etfFee: 6.95 },
  { name: 'RBC Direct Investing', stockFee: 9.95, etfFee: 9.95 },
  { name: 'Scotia iTRADE', stockFee: 9.99, etfFee: 9.99 },
  { name: 'Interactive Brokers', stockFee: 1.00, etfFee: 0 },
  { name: 'Custom', stockFee: 0, etfFee: 0 },
];

const DEFAULT_SETTINGS = {
  startingBalance: 1000,
  target: 1000000,
  platform: 'BMO InvestorLine',
  stockFee: 9.95,
  etfFee: 0,
  milestones: [1000, 10000, 100000, 1000000],
  currency: 'CAD',
};

const LuiLogo = () => (
  <svg viewBox="0 0 200 200" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="inkGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style={{stopColor:'#ffffff',stopOpacity:0.08}}/>
        <stop offset="100%" style={{stopColor:'#ffffff',stopOpacity:0}}/>
      </radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="inkTexture">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
        <feGaussianBlur in="displaced" stdDeviation="0.3" result="softened"/>
        <feMerge><feMergeNode in="softened"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="200" height="200" fill="#080808" rx="12"/>
    <ellipse cx="100" cy="95" rx="72" ry="78" fill="url(#inkGlow)"/>
    <text x="97" y="148" fontFamily="'Noto Serif SC','STKaiti','KaiTi','SimSun',serif" fontSize="120" fontWeight="400" textAnchor="middle" fill="#ffffff" opacity="0.07" filter="url(#glow)">雷</text>
    <text x="97" y="148" fontFamily="'Noto Serif SC','STKaiti','KaiTi','SimSun',serif" fontSize="120" fontWeight="400" textAnchor="middle" fill="#f0ece4" filter="url(#inkTexture)">雷</text>
    <line x1="40" y1="158" x2="155" y2="158" stroke="#f0ece4" strokeWidth="1.5" strokeLinecap="round" opacity="0.2"/>
    <text x="97" y="175" fontFamily="'Georgia',serif" fontSize="8" textAnchor="middle" fill="#f0ece4" opacity="0.3" letterSpacing="5">LUI</text>
  </svg>
);

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  async function handleLogin() {
    setLoading(true);
    const user = await onLogin();
    if (!user) setLoading(false);
  }
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className="flex justify-center mb-6"><LuiLogo/></div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight mb-2">Million Dollar Bot</h1>
        <p className="text-gray-500 font-mono text-sm mb-8">AI Stock Scanner · Paper Trading · 100-Baggers</p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-gray-400 text-sm mb-4">Sign in to access your personal trading dashboard</p>
          <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.02z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
        <p className="text-gray-700 text-xs font-mono">雷 Lui Trading · Your data is private and secure</p>
      </div>
    </div>
  );
}

function ChatWidget({ balance, trades, baggerPortfolio }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! Ask me anything about stocks, your portfolio, or trading strategy. I only give facts — no speculation! 📊' }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const portfolioContext = `Balance: $${balance}, Open trades: ${trades.filter(t=>t.status==='OPEN').map(t=>t.ticker).join(', ')||'none'}, 100-Bagger positions: ${baggerPortfolio.map(p=>p.ticker).join(', ')||'none'}`;

  async function handleSend() {
    if (!input.trim() || thinking) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setThinking(true);
    try {
      const answer = await askStockQuestion(question, portfolioContext);
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't get that right now. Try again!" }]);
    }
    setThinking(false);
  }

  const suggestions = ['What is NVDA?', 'Is IONQ a good long term hold?', 'What is P/E ratio?', 'Explain quantum computing stocks'];

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-all">
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-80 md:w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col" style={{height:'480px'}}>
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-white">🤖 AI Stock Assistant</p>
              <p className="text-xs text-gray-500">Facts only · No speculation</p>
            </div>
            <button onClick={() => setMessages([{role:'ai',text:'Hi! Ask me anything about stocks, your portfolio, or trading strategy. I only give facts — no speculation! 📊'}])} className="text-xs text-gray-600 hover:text-red-400">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg,i) => (
              <div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-xs rounded-2xl px-3 py-2 text-xs ${msg.role==='user'?'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30':'bg-gray-800 text-gray-300 border border-gray-700'}`}>{msg.text}</div>
              </div>
            ))}
            {thinking && <div className="flex justify-start"><div className="bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2 text-xs text-gray-500 animate-pulse">Researching facts...</div></div>}
            <div ref={messagesEndRef}/>
          </div>
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1">
              {suggestions.map((s,i) => <button key={i} onClick={() => setInput(s)} className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-1 rounded-full hover:border-cyan-500/50 hover:text-cyan-400 transition-all">{s}</button>)}
            </div>
          )}
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&handleSend()} placeholder="Ask about any stock..." className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-cyan-500/50 outline-none"/>
            <button onClick={handleSend} disabled={thinking} className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/30 disabled:opacity-50">
              {thinking ? '...' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsTab({ settings, onSave, user }) {
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);

  function handlePlatformChange(platformName) {
    const platform = PLATFORMS.find(p => p.name === platformName);
    setLocal(prev => ({ ...prev, platform: platformName, stockFee: platform.stockFee, etfFee: platform.etfFee }));
  }

  async function handleSave() {
    await onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const nextMilestone = local.milestones.find(m => m > (settings.currentBalance || local.startingBalance));

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-white font-bold mb-4">⚙️ Your Trading Setup</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Trading Platform</label>
            <select value={local.platform} onChange={e => handlePlatformChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white">
              {PLATFORMS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Stock Trade Fee ($)</label>
              <input type="number" value={local.stockFee} onChange={e => setLocal(prev => ({...prev, stockFee: parseFloat(e.target.value)||0}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">ETF Trade Fee ($)</label>
              <input type="number" value={local.etfFee} onChange={e => setLocal(prev => ({...prev, etfFee: parseFloat(e.target.value)||0}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Starting Balance ($)</label>
              <input type="number" value={local.startingBalance} onChange={e => setLocal(prev => ({...prev, startingBalance: parseFloat(e.target.value)||1000}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Target Goal ($)</label>
              <input type="number" value={local.target} onChange={e => setLocal(prev => ({...prev, target: parseFloat(e.target.value)||1000000}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Currency</label>
            <select value={local.currency} onChange={e => setLocal(prev => ({...prev, currency: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white">
              <option value="CAD">CAD 🇨🇦</option>
              <option value="USD">USD 🇺🇸</option>
            </select>
          </div>
        </div>
        <button onClick={handleSave} className={`w-full mt-4 py-3 rounded-xl text-sm font-bold transition-all ${saved?'bg-emerald-500 text-black':'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'}`}>
          {saved ? '✅ Saved!' : 'Save Settings'}
        </button>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-white font-bold mb-3">🎯 Milestones</p>
        <div className="space-y-2">
          {local.milestones.map((milestone, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${milestone <= local.startingBalance ? 'bg-emerald-400' : 'bg-gray-700'}`}/>
              <span className="text-sm font-mono text-gray-300">${milestone.toLocaleString()}</span>
              {milestone === nextMilestone && <span className="text-xs text-cyan-400">← Next milestone</span>}
              {milestone <= local.startingBalance && <span className="text-xs text-emerald-400">✅ Reached</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-white font-bold mb-3">👤 Account</p>
        <div className="flex items-center gap-3 mb-4">
          {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-10 h-10 rounded-full"/>}
          <div>
            <p className="text-sm font-bold text-white">{user.displayName}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button onClick={signOutUser} className="w-full py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-all">Sign Out</button>
      </div>
    </div>
  );
}

function ConfidenceRing({ value }) {
  const safeValue = (!value || isNaN(value)) ? 0 : value;
  const color = safeValue >= 80 ? '#10b981' : safeValue >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute" width="56" height="56" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#1f2937" strokeWidth="6"/>
        <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(safeValue/100)*175.9} 175.9`} strokeLinecap="round" transform="rotate(-90 32 32)"/>
      </svg>
      <span className="text-xs font-bold font-mono" style={{color}}>{safeValue}%</span>
    </div>
  );
}

function ScannerBadge({ type }) {
  const config = {
    gainer: { label: '📈 Top Gainer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    active: { label: '🔥 Most Active', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    news: { label: '📰 News Driven', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    custom: { label: '✏️ Custom', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  };
  const c = config[type] || config.news;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.color}`}>{c.label}</span>;
}

function WatchlistCard({ stock, onRemove, onBuyNow }) {
  const [news, setNews] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [priceRes, newsData] = await Promise.all([
          fetch(`/api/get-price?ticker=${stock.ticker}`).then(r => r.json()),
          getWatchlistNews(stock.ticker),
        ]);
        const price = priceRes.price || stock.addedPrice;
        setCurrentPrice(price);
        setNews(newsData);
        const rec = await getWatchlistRecommendation(stock, price, newsData);
        setRecommendation(rec);
      } catch (e) {
        setCurrentPrice(stock.addedPrice);
      }
      setLoading(false);
    }
    load();
  }, [stock]);

  const priceChange = currentPrice ? ((currentPrice - stock.addedPrice) / stock.addedPrice * 100).toFixed(2) : 0;
  const priceUp = parseFloat(priceChange) >= 0;
  const recColor = recommendation?.recommendation === 'BUY NOW' ? 'emerald' : recommendation?.recommendation === 'DROP IT' ? 'red' : 'amber';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold text-white">{stock.ticker}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stock.signal==='BUY'?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{stock.signal}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono">Added {new Date(stock.addedAt).toLocaleDateString()} @ ${stock.addedPrice}</p>
          {currentPrice && (
            <p className="text-xs font-mono mt-1">
              <span className="text-gray-400">Now: </span>
              <span className="text-white font-bold">${currentPrice}</span>
              <span className={`ml-2 font-bold ${priceUp?'text-emerald-400':'text-red-400'}`}>{priceUp?'▲':'▼'} {Math.abs(priceChange)}%</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConfidenceRing value={stock.confidence}/>
          <button onClick={() => onRemove(stock.ticker)} className="text-xs text-gray-600 hover:text-red-400">✕ Remove</button>
        </div>
      </div>

      {loading && <p className="text-xs text-gray-500 animate-pulse mb-3">🔍 Analyzing...</p>}

      {!loading && recommendation && (
        <div className={`rounded-xl p-3 mb-3 ${recColor==='emerald'?'bg-emerald-500/10 border border-emerald-500/20':recColor==='red'?'bg-red-500/10 border border-red-500/20':'bg-amber-500/10 border border-amber-500/20'}`}>
          <p className={`text-xs font-bold mb-1 ${recColor==='emerald'?'text-emerald-400':recColor==='red'?'text-red-400':'text-amber-400'}`}>
            🤖 {recommendation.recommendation}
          </p>
          <p className="text-xs text-gray-400">{recommendation.reasoning}</p>
        </div>
      )}

      {news.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Latest News</p>
          {news.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-800/50 rounded-xl p-2 hover:bg-gray-800 transition-all">
              <p className="text-xs text-gray-300 line-clamp-2">{item.title}</p>
              <p className="text-xs text-gray-600 mt-1">{item.source} · {new Date(item.publishedAt).toLocaleDateString()}</p>
            </a>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {recommendation?.recommendation === 'BUY NOW' && (
          <button onClick={() => onBuyNow(stock)} className="flex-1 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/30">💰 Buy Now</button>
        )}
        {recommendation?.recommendation === 'DROP IT' && (
          <button onClick={() => onRemove(stock.ticker)} className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/30">🗑 Drop It</button>
        )}
      </div>
    </div>
  );
}

function SignalCard({ signal, onTrade, onWatch, onChart, balance, settings }) {  const [actualEntry, setActualEntry] = useState(signal.price || signal.entry || 0);
  const stockFee = settings?.stockFee ?? 9.95;
  const etfFee = settings?.etfFee ?? 0;
  const fee = isETF(signal.ticker) ? etfFee : stockFee;
  const isAvoid = signal.action === 'AVOID';
  const isLong = signal.action === 'BUY';

  const minPositionForFee = fee > 0 ? Math.ceil(fee / (actualEntry * 0.02)) * actualEntry + fee : 0;
  const tenPercent = balance * 0.10;
  const recommendedAmount = fee > 0 ? Math.max(minPositionForFee, Math.min(tenPercent, balance * 0.25)) : tenPercent;
  const shares = actualEntry > 0 ? Math.max(1, Math.floor((recommendedAmount - fee) / actualEntry)) : 1;
  const totalCost = (shares * (actualEntry || 0)) + fee;
  const feePercent = totalCost > 0 ? ((fee / totalCost) * 100).toFixed(1) : '0';
  const breakeven = actualEntry > 0 ? ((actualEntry * shares + fee) / shares).toFixed(2) : '0';
  const percentOfBalance = ((totalCost / balance) * 100).toFixed(1);
  const highFee = fee > 0 && parseFloat(feePercent) > 3;

  const riskColor = signal.risk === 'Low' ? 'green' : signal.risk === 'Medium' ? 'amber' : 'red';
  const change = signal.change;
  const hasChange = change !== null && change !== undefined && !isNaN(change);
  const changeColor = hasChange && change >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 ${isAvoid?'border-gray-700 opacity-70':isLong?'border-emerald-500/20':'border-red-500/20'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 mr-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAvoid?'bg-gray-700 text-gray-400':isLong?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{signal.action}</span>
            <span className="text-xl font-bold text-white">{signal.ticker}</span>
            {isETF(signal.ticker) && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">ETF·{etfFee===0?'FREE':'$'+etfFee}</span>}
            {signal.scannerFlag && <ScannerBadge type={signal.scannerFlag}/>}
            <span className={`text-xs font-mono ${changeColor}`}>{hasChange?`${change>=0?'▲':'▼'} ${Math.abs(change)}%`:'--'}</span>
          </div>
          <p className="text-gray-500 text-xs font-mono">Signal: ${signal.entry} · Target: ${signal.target} · Stop: ${signal.stop}</p>
          <p className="text-gray-400 text-xs font-mono mt-0.5">Live: <span className="text-white font-bold">{signal.price?`$${signal.price}`:'Cached'}</span> · Vol: {signal.volume||'N/A'}</p>
          <p className="text-gray-600 text-xs mt-1 italic">{signal.reasoning}</p>
        </div>
        <ConfidenceRing value={signal.confidence}/>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex justify-between">
          <span className="text-xs text-gray-400">Agreement</span>
          <span className="text-xs font-bold text-emerald-400">{signal.agreement}</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex justify-between">
          <span className="text-xs text-gray-400">Data</span>
          <span className="text-xs font-bold text-emerald-400">✅ {signal.dataFresh}</span>
        </div>
        <div className={`rounded-xl p-2 flex justify-between ${riskColor==='green'?'bg-emerald-500/10 border border-emerald-500/20':riskColor==='amber'?'bg-amber-500/10 border border-amber-500/20':'bg-red-500/10 border border-red-500/20'}`}>
          <span className="text-xs text-gray-400">Risk</span>
          <span className={`text-xs font-bold ${riskColor==='green'?'text-emerald-400':riskColor==='amber'?'text-amber-400':'text-red-400'}`}>{signal.risk==='Low'?'✅':signal.risk==='Medium'?'⚠️':'🚨'} {signal.risk}</span>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-2 flex justify-between">
          <span className="text-xs text-gray-400">Confidence</span>
          <span className={`text-xs font-bold ${signal.confidence>=80?'text-emerald-400':signal.confidence>=60?'text-amber-400':'text-red-400'}`}>{signal.confidence>=80?'✅':signal.confidence>=60?'⚠️':'🚨'} {signal.confidence||0}%</span>
        </div>
      </div>
      {!isAvoid && (
        <div className="mt-2 bg-gray-800/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Actual entry $:</span>
            <input type="number" value={actualEntry} onChange={e => setActualEntry(parseFloat(e.target.value)||0)} className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono"/>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono"><span className="text-gray-400">Smart size: </span><span className="text-white font-bold">{shares} shares</span><span className="text-emerald-400"> · ${totalCost.toFixed(0)}</span><span className="text-gray-600"> ({percentOfBalance}% of balance)</span></p>
            <p className="text-xs font-mono"><span className="text-gray-600">Fee: </span><span className={fee===0?'text-emerald-400':highFee?'text-amber-400':'text-emerald-400'}>{fee===0?'FREE':`$${fee} (${feePercent}%)`}</span><span className="text-gray-600"> · BE: </span><span className="text-white">${breakeven}</span></p>
            {highFee && <p className="text-xs text-amber-400">💡 Fee is {feePercent}% — acceptable at this balance. Grow account to reduce fee impact.</p>}
            <p className="text-xs text-gray-600">Remaining after trade: <span className="text-white">${(balance-totalCost).toFixed(0)}</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onTrade(signal, shares, actualEntry, fee)} className="flex-1 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/30 transition-all">📝 Paper Trade</button>
<button onClick={() => onWatch(signal)} className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/30 transition-all">👁 Watch</button>
            <button onClick={() => onChart(signal.ticker)} className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-bold hover:bg-purple-500/30 transition-all">📊 Chart</button>
          </div>
        </div>
      )}
    </div>
  );
}
function BaggerCard({ bagger, onAddToPortfolio }) {
  const scoreColor = bagger.score>=90?'text-emerald-400':bagger.score>=80?'text-cyan-400':bagger.score>=70?'text-amber-400':'text-red-400';
  const [shares, setShares] = useState(1);
  const [price, setPrice] = useState('');
  const [showMF, setShowMF] = useState(false);
  const mf = bagger.magicFormula;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xl font-bold text-white">{bagger.ticker}</p>
          <p className="text-xs text-gray-500">{bagger.sector}</p>
          <p className="text-xs text-gray-600 font-mono mt-1">⏱ {bagger.timeframe}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold font-mono ${scoreColor}`}>{bagger.score}</p>
          <p className="text-xs text-gray-500">/ 100</p>
          <p className="text-xs text-emerald-400 font-mono mt-1">🚀 {bagger.upside}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 italic mb-3">{bagger.reasoning}</p>
      {mf && (
        <div className="mb-3">
          <button onClick={() => setShowMF(!showMF)} className="text-xs text-amber-400 hover:text-amber-300 mb-2">{showMF?'▲ Hide':'▼ Show'} Greenblatt Magic Formula</button>
          {showMF && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 grid grid-cols-2 gap-2">
              <div><p className="text-xs text-gray-500 mb-1">Return on Capital</p><p className="text-sm font-bold text-amber-400">{mf.returnOnCapital}/10</p><p className="text-xs text-gray-600">{mf.rocRank}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">Earnings Yield</p><p className="text-sm font-bold text-amber-400">{mf.earningsYield}/10</p><p className="text-xs text-gray-600">{mf.eyRank}</p></div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 bg-gray-800/50 rounded-xl p-3">
        <input type="number" value={shares} onChange={e => setShares(parseInt(e.target.value)||1)} placeholder="Shares" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono"/>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price $" className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono"/>
        <button onClick={() => { if(price){onAddToPortfolio(bagger,shares,parseFloat(price));setPrice('');}}} className="ml-auto px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/30">📈 Add</button>
      </div>
    </div>
  );
}

function BaggerPositionCard({ position, onRemove }) {
  const signal = getBaggerSignal(position, position.avgPrice);
  const progress = (1/100)*100;
  const sc = signal.signal==='BUY MORE'?'emerald':signal.signal==='ACCUMULATE'?'cyan':signal.signal==='REVIEW'?'amber':'gray';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 relative">
      <button onClick={onRemove} className="absolute top-3 right-3 text-xs text-gray-600 hover:text-red-400">✕</button>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xl font-bold text-white">{position.ticker}</p>
          <p className="text-xs text-gray-500">{position.sector}</p>
          <p className="text-xs text-gray-600 font-mono mt-1">{position.shares} shares · avg ${position.avgPrice}</p>
          <p className="text-xs text-gray-600 font-mono">Invested: ${position.totalInvested?.toFixed(0)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">100x target</p>
          <p className="text-lg font-bold text-cyan-400">${(position.avgPrice*100).toFixed(2)}</p>
        </div>
      </div>
      <div className={`rounded-xl p-3 mb-3 ${sc==='emerald'?'bg-emerald-500/10 border border-emerald-500/20':sc==='cyan'?'bg-cyan-500/10 border border-cyan-500/20':sc==='amber'?'bg-amber-500/10 border border-amber-500/20':'bg-gray-800 border border-gray-700'}`}>
        <p className={`text-xs font-bold mb-1 ${sc==='emerald'?'text-emerald-400':sc==='cyan'?'text-cyan-400':sc==='amber'?'text-amber-400':'text-gray-400'}`}>{signal.signal}</p>
        <p className="text-xs text-gray-400">{signal.reason}</p>
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Progress to 100x</span>
          <span className="text-xs text-gray-600 font-mono">{progress.toFixed(3)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-1.5 rounded-full" style={{width:`${Math.max(progress,0.1)}%`}}/>
        </div>
      </div>
    </div>
  );
}

function TradeRow({ trade, onClose }) {
  const [exitPrice, setExitPrice] = useState('');
  const isOpen = trade.status === 'OPEN';
  const pnlColor = trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className={`bg-gray-900 border rounded-xl p-3 ${isOpen?'border-amber-500/20':trade.pnl>0?'border-emerald-500/20':'border-red-500/20'}`}>
      <div className="flex justify-between items-center">
        <div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${isOpen?'bg-amber-500/20 text-amber-400':trade.pnl>0?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{isOpen?'OPEN':'CLOSED'}</span>
          <span className="font-bold text-white">{trade.ticker}</span>
          {trade.isETF && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full ml-1">ETF</span>}
          <span className="text-xs text-gray-500 ml-2 font-mono">{trade.shares}x @ ${trade.actualEntry||trade.entry}</span>
        </div>
        {!isOpen && <span className={`font-bold font-mono text-sm ${pnlColor}`}>{trade.pnl>0?'+':''}${trade.pnl} ({trade.pnlPercent>0?'+':''}{trade.pnlPercent}%)</span>}
      </div>
      <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
        <span className="text-xs text-gray-600 font-mono">Fee: ${trade.fee} · Target: ${trade.target} · Stop: ${trade.stop}</span>
        {isOpen && (
          <div className="flex items-center gap-2">
            <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="Exit $" className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono"/>
            <button onClick={() => exitPrice && onClose(trade.id, parseFloat(exitPrice))} className="px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trading');
  const [signals, setSignals] = useState([]);
  const [baggers, setBaggers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [customTicker, setCustomTicker] = useState('');
  const [customTickers, setCustomTickers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [balance, setBalance] = useState(1000);
  const [baggerPortfolio, setBaggerPortfolio] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toast, setToast] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [chartTicker, setChartTicker] = useState(null);
  const target = settings.target;
  const progress = (balance / target) * 100;
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const wins = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl <= 0);
  const winRate = closedTrades.length > 0 ? ((wins.length / closedTrades.length) * 100).toFixed(1) : 0;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2);
  const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0) + (t.exitFee || 0), 0).toFixed(2);
  const portfolioHistory = [{ day: 'Start', value: settings.startingBalance }, { day: 'Now', value: balance }];
  const nextMilestone = settings.milestones?.find(m => m > balance);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        setDbLoading(true);
        const [bal, tradeList, baggerList, savedSettings, watchlistData] = await Promise.all([
          getBalanceDB(firebaseUser.uid),
          getTradesDB(firebaseUser.uid),
          getBaggerPortfolioDB(firebaseUser.uid),
          getSettingsDB(firebaseUser.uid),
          getWatchlistDB(firebaseUser.uid),
        ]);
        setBalance(bal);
        setTrades(tradeList);
        setBaggerPortfolio(baggerList);
        setSettings(savedSettings);
        setWatchlist(watchlistData);
        setDbLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleAddCustomTicker() {
    if (!customTicker || customTicker.length < 1) return;
    setCustomTickers(prev => [...new Set([...prev, customTicker])]);
    setCustomTicker('');
    showToast(`✅ Added ${customTicker} to scan list!`);
  }

  async function handleSaveSettings(newSettings) {
    await saveSettingsDB(user.uid, newSettings);
    setSettings(newSettings);
    showToast('✅ Settings saved!');
  }

  async function handleWatch(signal) {
    if (watchlist.length >= 15) { showToast('⚠️ Watchlist full! Remove a stock first.', 'error'); return; }
    if (watchlist.find(w => w.ticker === signal.ticker)) { showToast('Already on watchlist!', 'error'); return; }
    const item = {
      ticker: signal.ticker,
      signal: signal.action,
      confidence: signal.confidence,
      addedPrice: signal.price || signal.entry,
      addedAt: new Date().toISOString(),
      target: signal.target,
      stop: signal.stop,
    };
    await addToWatchlistDB(user.uid, item);
    setWatchlist(prev => [...prev, item]);
    showToast(`👁 ${signal.ticker} added to watchlist!`);
  }

  async function handleRemoveWatch(ticker) {
    await removeFromWatchlistDB(user.uid, ticker);
    setWatchlist(prev => prev.filter(w => w.ticker !== ticker));
    showToast(`Removed ${ticker} from watchlist`);
  }

  async function handleTrade(signal, shares, actualEntry, fee) {
    const tradeFee = fee ?? (isETF(signal.ticker) ? settings.etfFee : settings.stockFee);
    const totalInvested = (shares * actualEntry) + tradeFee;
    if (balance < totalInvested) { showToast('❌ Insufficient balance!', 'error'); return; }
    const newBalance = parseFloat((balance - totalInvested).toFixed(2));
    const trade = {
      ticker: signal.ticker, action: signal.action, entry: signal.entry, actualEntry,
      target: signal.target, stop: signal.stop, confidence: signal.confidence,
      reasoning: signal.reasoning, shares, fee: tradeFee, isETF: isETF(signal.ticker),
      totalInvested, status: 'OPEN', openedAt: new Date().toISOString(),
      closedAt: null, exitPrice: null, pnl: null, pnlPercent: null, exitFee: null,
    };
    const saved = await addTradeDB(user.uid, trade);
    if (!saved) { showToast('❌ Error saving trade!', 'error'); return; }
    await setBalanceDB(user.uid, newBalance);
    setBalance(newBalance);
    setTrades(prev => [saved, ...prev]);
    showToast(`📝 Opened: ${shares}x ${signal.ticker} @ $${actualEntry} · Fee: ${tradeFee===0?'FREE':'$'+tradeFee}`);
  }

  async function handleClose(tradeId, exitPrice) {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;
    const exitFee = isETF(trade.ticker) ? settings.etfFee : settings.stockFee;
    const grossPnl = (exitPrice - trade.actualEntry) * trade.shares;
    const pnl = parseFloat((grossPnl - exitFee).toFixed(2));
    const pnlPercent = parseFloat(((pnl / trade.totalInvested) * 100).toFixed(2));
    const proceeds = (exitPrice * trade.shares) - exitFee;
    const newBalance = parseFloat((balance + proceeds).toFixed(2));
    const updates = { status: 'CLOSED', closedAt: new Date().toISOString(), exitPrice, exitFee, pnl, pnlPercent };
    await updateTradeDB(user.uid, tradeId, updates);
    await setBalanceDB(user.uid, newBalance);
    setBalance(newBalance);
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
    showToast(`${pnl>0?'🎉':'📉'} Closed: ${pnl>0?'+':''}$${pnl} after fees`, pnl>0?'success':'error');
  }

  async function handleAddToBagger(bagger, shares, price) {
    const position = { ticker: bagger.ticker, sector: bagger.sector, shares, avgPrice: price, totalInvested: parseFloat((shares*price).toFixed(2)), addedAt: new Date().toISOString() };
    await addBaggerPositionDB(user.uid, position);
    setBaggerPortfolio(prev => {
      const existing = prev.findIndex(p => p.ticker === bagger.ticker);
      if (existing >= 0) {
        const pos = prev[existing];
        const totalShares = pos.shares + shares;
        const avgPrice = ((pos.avgPrice*pos.shares)+(price*shares))/totalShares;
        const updated = [...prev];
        updated[existing] = { ...pos, shares: totalShares, avgPrice: parseFloat(avgPrice.toFixed(2)), totalInvested: parseFloat((totalShares*avgPrice).toFixed(2)) };
        return updated;
      }
      return [...prev, position];
    });
    showToast(`📈 Added ${shares}x ${bagger.ticker} @ $${price}!`);
  }

  async function handleRemoveBagger(ticker) {
    if (window.confirm(`Remove ${ticker}?`)) {
      await removeBaggerPositionDB(user.uid, ticker);
      setBaggerPortfolio(prev => prev.filter(p => p.ticker !== ticker));
      showToast(`Removed ${ticker}`);
    }
  }

  async function handleReset() {
    if (window.confirm('Reset ALL trading data?')) {
      await resetAllDB(user.uid);
      setTrades([]); setBalance(settings.startingBalance); setBaggerPortfolio([]);
      showToast('🔄 Reset to $' + settings.startingBalance);
    }
  }

  async function fetchSignals() {
    setLoading(true); setScanStats(null);
    setLoadingMsg('🔍 Scanning market for opportunities...');
    try {
      const scanResults = await runDailyScan();
      let candidates = scanResults.swingCandidates;
      if (customTickers.length > 0) {
        const customStocks = customTickers.map(t => ({ ticker: t, price: 0, change: 0, volume: '0', type: 'custom' }));
        candidates = [...customStocks, ...candidates];
      }
      if (candidates.length === 0) {
        setLoadingMsg('⚠️ Scanner rate limited — using fallback stocks...');
        candidates = FALLBACK_STOCKS;
      } else {
        setScanStats({ swingFound: scanResults.swingCandidates.length, newsStocks: scanResults.newsStocks.length });
        setLoadingMsg(`✅ Found ${candidates.length} candidates! Analyzing with Gemini...`);
      }
      const results = await analyzeScannedStocks(candidates);
      const filtered = results.filter(s => s.action !== 'HOLD');
      setSignals(filtered);
      setLastUpdated(new Date().toLocaleTimeString());
      const strongBuys = filtered.filter(s => s.action === 'BUY' && s.confidence >= 80);
      for (const s of strongBuys) {
        await sendTelegramAlert(
          `🚨 <b>STRONG BUY SIGNAL</b>\n\n` +
          `📈 <b>${s.ticker}</b> @ $${s.price || s.entry}\n` +
          `💪 Confidence: ${s.confidence}%\n` +
          `🎯 Target: $${s.target} · Stop: $${s.stop}\n` +
          `📊 ${s.reasoning}`
        );
      }
    } catch (e) { console.error('Signal error:', e); showToast('❌ Scanner error', 'error'); }
    setLoading(false); setLoadingMsg('');
  }

  async function fetchBaggers() {
    setLoading(true); setLoadingMsg('🔍 Scanning for 100-bagger candidates...');
    try {
      const scanResults = await runDailyScan();
      let results;
      if (scanResults.baggerCandidates.length > 0) {
        setLoadingMsg(`✅ Found ${scanResults.baggerCandidates.length} candidates! Applying Greenblatt scoring...`);
        results = await findBaggersFromScan(scanResults.baggerCandidates);
      } else {
        setLoadingMsg('⚠️ Using curated list...');
        results = await findBaggers(['IONQ','RXRX','CRSP','EDIT','SOUN','NVDA','PLTR','HIMS','SHOP','LSPD']);
      }
      setBaggers(results.sort((a,b) => b.score-a.score));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) { console.error('Bagger error:', e); }
    setLoading(false); setLoadingMsg('');
  }

  if (authLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-emerald-400 font-mono animate-pulse">Loading...</p>
    </div>
  );

  if (!user) return <LoginScreen onLogin={signInWithGoogle}/>;

  if (dbLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-emerald-400 font-mono animate-pulse">Loading your portfolio...</p>
        <p className="text-gray-600 font-mono text-xs mt-2">Welcome, {user.displayName}!</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg max-w-xs ${toast.type==='success'?'bg-emerald-500/90 text-black':'bg-red-500/90 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <ChatWidget balance={balance} trades={trades} baggerPortfolio={baggerPortfolio}/>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <LuiLogo/>
            <div>
              <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">Million Dollar Bot</h1>
              <p className="text-gray-500 mt-1 font-mono text-xs md:text-sm">${settings.startingBalance.toLocaleString()} → ${settings.target.toLocaleString()} // {settings.platform}</p>
            </div>
          </div>
          <div className="text-right">
            {lastUpdated && <p className="text-xs text-gray-600 font-mono hidden md:block">Updated: {lastUpdated}</p>}
            <div className="flex items-center gap-2 justify-end mt-1">
              {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full"/>}
              <button onClick={() => setActiveTab('settings')} className="text-xs text-gray-500 hover:text-white transition-all">⚙️</button>
            </div>
            <button onClick={activeTab==='trading'?fetchSignals:activeTab==='baggers'?fetchBaggers:null} disabled={loading} className="mt-2 px-3 md:px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50">
              {loading?'⏳...':'🔍 Scan Market'}
            </button>
          </div>
        </div>

        {nextMilestone && (
          <div className="bg-gray-900 border border-purple-500/20 rounded-2xl p-3 mb-5">
            <p className="text-purple-400 text-xs font-mono">🎯 Next milestone: <span className="font-bold">${nextMilestone.toLocaleString()}</span> · Need <span className="font-bold">${(nextMilestone-balance).toFixed(0)}</span> more</p>
          </div>
        )}

        {scanStats && (
          <div className="bg-gray-900 border border-emerald-500/20 rounded-2xl p-3 mb-5">
            <p className="text-emerald-400 text-xs font-mono">🔍 Scan found <span className="font-bold">{scanStats.swingFound} swing candidates</span> · <span className="font-bold">{scanStats.newsStocks} news-driven stocks</span></p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Balance</p>
            <p className="text-xl md:text-2xl font-bold font-mono text-emerald-400">${balance.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">{parseFloat(totalPnl)>=0?'+':''}${totalPnl} P&L</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Win Rate</p>
            <p className="text-xl md:text-2xl font-bold font-mono text-cyan-400">{winRate}%</p>
            <p className="text-xs text-gray-600 mt-1">{wins.length}W / {losses.length}L</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Total Fees</p>
            <p className="text-xl md:text-2xl font-bold font-mono text-red-400">${totalFees}</p>
            <p className="text-xs text-gray-600 mt-1">{settings.platform}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Target</p>
            <p className="text-xl md:text-2xl font-bold font-mono text-purple-400">${(settings.target/1000).toFixed(0)}K</p>
            <p className="text-xs text-gray-600 mt-1">{progress.toFixed(2)}% there</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5">
          <div className="flex justify-between mb-2">
            <p className="text-gray-500 text-xs uppercase tracking-widest">Progress to ${settings.target.toLocaleString()}</p>
            <p className="text-xs font-mono text-gray-400">{progress.toFixed(4)}%</p>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-3 rounded-full" style={{width:`${Math.max(progress,0.15)}%`}}/>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-600 font-mono">${settings.startingBalance.toLocaleString()}</span>
            <span className="text-xs text-gray-600 font-mono">${settings.target.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Portfolio Growth</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={portfolioHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
              <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:11}} axisLine={false}/>
              <YAxis tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickFormatter={v=>`$${v}`}/>
              <Tooltip contentStyle={{backgroundColor:'#111827',border:'1px solid #374151',borderRadius:'12px'}} labelStyle={{color:'#9ca3af'}} formatter={v=>[`$${v.toLocaleString()}`,'Portfolio']}/>
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{fill:'#10b981',r:4}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button onClick={() => { setActiveTab('trading'); fetchSignals(); }} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='trading'?'bg-emerald-500 text-black':'bg-gray-800 text-gray-400'}`}>⚡ Signals</button>
          <button onClick={() => { setActiveTab('baggers'); fetchBaggers(); }} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='baggers'?'bg-cyan-500 text-black':'bg-gray-800 text-gray-400'}`}>🔭 100-Baggers</button>
          <button onClick={() => setActiveTab('baggerPortfolio')} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='baggerPortfolio'?'bg-cyan-500 text-black':'bg-gray-800 text-gray-400'}`}>📈 Portfolio ({baggerPortfolio.length})</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='watchlist'?'bg-yellow-500 text-black':'bg-gray-800 text-gray-400'}`}>👁 Watchlist ({watchlist.length})</button>
          <button onClick={() => setActiveTab('tracker')} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='tracker'?'bg-purple-500 text-black':'bg-gray-800 text-gray-400'}`}>📊 Trades ({openTrades.length})</button>
          <button onClick={() => setActiveTab('settings')} className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab==='settings'?'bg-gray-500 text-white':'bg-gray-800 text-gray-400'}`}>⚙️ Settings</button>
        </div>

        {loading && <div className="text-center py-12"><p className="text-emerald-400 font-mono text-sm animate-pulse">⏳ {loadingMsg}</p></div>}

        {!loading && activeTab==='trading' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-3">
              <p className="text-amber-400 text-xs font-mono mb-2">💰 {settings.platform}: Stocks ${settings.stockFee} · ETFs {settings.etfFee===0?'FREE':'$'+settings.etfFee} · Scanner finds best opportunities daily</p>
              <div className="flex gap-2">
                <input type="text" value={customTicker} onChange={e => setCustomTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key==='Enter'&&handleAddCustomTicker()} placeholder="Add any ticker (e.g. TSLA)" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase placeholder-gray-600" maxLength={6}/>
                <button onClick={handleAddCustomTicker} className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/30">+ Add</button>
              </div>
              {customTickers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {customTickers.map(t => (
                    <span key={t} className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      {t} <button onClick={() => setCustomTickers(prev => prev.filter(x => x !== t))} className="hover:text-red-400">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {signals.length===0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 font-mono text-sm mb-2">🔍 Ready to scan the market</p>
                <p className="text-gray-600 font-mono text-xs">Click "Scan Market" to find today's best opportunities</p>
              </div>
            )}
{signals.map((signal,i) => <SignalCard key={i} signal={signal} onTrade={handleTrade} onWatch={handleWatch} onChart={setChartTicker} balance={balance} settings={settings}/>)}          </div>
        )}

        {!loading && activeTab==='baggers' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-900 border border-cyan-500/20 rounded-2xl p-4">
              <p className="text-cyan-400 text-xs uppercase tracking-widest">🔭 100-Bagger Scanner</p>
              <p className="text-gray-500 text-xs mt-1">Scans market daily · Greenblatt Magic Formula + Growth KPIs</p>
            </div>
            {baggers.length===0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 font-mono text-sm mb-2">🔭 Ready to find 100-baggers</p>
                <p className="text-gray-600 font-mono text-xs">Click "Scan Market" to discover long-term opportunities</p>
              </div>
            )}
            {baggers.map((bagger,i) => <BaggerCard key={i} bagger={bagger} onAddToPortfolio={handleAddToBagger}/>)}
          </div>
        )}

        {activeTab==='baggerPortfolio' && (
          <div>
            <div className="bg-gray-900 border border-cyan-500/20 rounded-2xl p-4 mb-4">
              <p className="text-cyan-400 text-xs uppercase tracking-widest">📈 Your 100-Bagger Portfolio</p>
              <p className="text-gray-500 text-xs mt-1">Synced across all devices · Long-term holds · Buy more on dips</p>
            </div>
            {baggerPortfolio.length===0 && <p className="text-gray-600 text-center py-8 font-mono">No positions — scan 100-Baggers and add stocks!</p>}
            <div className="grid grid-cols-1 gap-4">
              {baggerPortfolio.map((pos,i) => <BaggerPositionCard key={i} position={pos} onRemove={() => handleRemoveBagger(pos.ticker)}/>)}
            </div>
          </div>
        )}

        {activeTab==='watchlist' && (
          <div>
            <div className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-yellow-400 text-xs uppercase tracking-widest">👁 Watchlist</p>
                  <p className="text-gray-500 text-xs mt-1">Track stocks · AI recommendations · Latest news · {watchlist.length}/15 slots used</p>
                </div>
              </div>
            </div>
            {watchlist.length===0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 font-mono text-sm mb-2">👁 Your watchlist is empty</p>
                <p className="text-gray-600 font-mono text-xs">Click "👁 Watch" on any signal card to add stocks here</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4">
              {watchlist.map((stock, i) => (
                <WatchlistCard
                  key={i}
                  stock={stock}
                  onRemove={handleRemoveWatch}
                  onBuyNow={(s) => { setActiveTab('trading'); showToast(`Search for ${s.ticker} in signals!`); }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab==='tracker' && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">P&L</p>
                <p className={`text-xl font-bold font-mono ${parseFloat(totalPnl)>=0?'text-emerald-400':'text-red-400'}`}>{parseFloat(totalPnl)>=0?'+':''}${totalPnl}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Win Rate</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{winRate}%</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Fees</p>
                <p className="text-xl font-bold font-mono text-red-400">${totalFees}</p>
              </div>
            </div>
            {openTrades.length>0 && (
              <div className="mb-5">
                <p className="text-amber-400 text-xs uppercase tracking-widest mb-3">🟡 Open ({openTrades.length})</p>
                <div className="grid grid-cols-1 gap-3">{openTrades.map(t => <TradeRow key={t.id} trade={t} onClose={handleClose}/>)}</div>
              </div>
            )}
            {closedTrades.length>0 && (
              <div className="mb-5">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">✅ Closed ({closedTrades.length})</p>
                <div className="grid grid-cols-1 gap-3">{closedTrades.map(t => <TradeRow key={t.id} trade={t} onClose={handleClose}/>)}</div>
              </div>
            )}
            {trades.length===0 && <p className="text-gray-600 text-center py-8 font-mono">No trades yet — scan the market and paper trade!</p>}
            <button onClick={handleReset} className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/20">🔄 Reset Everything</button>
          </div>
        )}

        {activeTab==='settings' && <SettingsTab settings={{...settings, currentBalance: balance}} onSave={handleSaveSettings} user={user}/>}

        <p className="text-center text-gray-700 text-xs font-mono mt-8">雷 Lui Trading · Gemini AI · Market Scanner · Firebase · {settings.platform}</p>
      </div>
      {chartTicker && <StockChart ticker={chartTicker} onClose={() => setChartTicker(null)}/>}
    </div>
  );
}

export default App;