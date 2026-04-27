const TRADES_KEY = 'lui_trading_trades';
const BALANCE_KEY = 'lui_trading_balance';
const BAGGER_KEY = 'lui_bagger_portfolio';
const STARTING_BALANCE = 1000;

const BMO_STOCK_FEE = 9.95;
const BMO_ETF_FEE = 0;

const ETF_TICKERS = ['ARKG', 'SPY', 'QQQ', 'XIC', 'VFV', 'ZSP', 'XIU', 'HXT'];

export function isETF(ticker) {
  return ETF_TICKERS.includes(ticker.toUpperCase());
}

export function getTradeFee(ticker) {
  return isETF(ticker) ? BMO_ETF_FEE : BMO_STOCK_FEE;
}

export function getBalance() {
  const stored = localStorage.getItem(BALANCE_KEY);
  return stored ? parseFloat(stored) : STARTING_BALANCE;
}

export function setBalance(amount) {
  localStorage.setItem(BALANCE_KEY, amount.toString());
}

export function getTrades() {
  const stored = localStorage.getItem(TRADES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addTrade(trade) {
  const trades = getTrades();
  const fee = getTradeFee(trade.ticker);
  const totalInvested = (trade.shares * trade.entry) + fee;

  const newTrade = {
    id: Date.now(),
    ticker: trade.ticker,
    action: trade.action,
    entry: trade.entry,
    actualEntry: trade.actualEntry || trade.entry,
    target: trade.target,
    stop: trade.stop,
    confidence: trade.confidence,
    reasoning: trade.reasoning,
    shares: trade.shares,
    fee,
    isETF: isETF(trade.ticker),
    totalInvested,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    closedAt: null,
    exitPrice: null,
    pnl: null,
    pnlPercent: null,
  };

  const currentBalance = getBalance();
  if (currentBalance < totalInvested) return null;
  setBalance(parseFloat((currentBalance - totalInvested).toFixed(2)));

  trades.push(newTrade);
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
  return newTrade;
}

export function closeTrade(tradeId, exitPrice) {
  const trades = getTrades();
  const index = trades.findIndex(t => t.id === tradeId);
  if (index === -1) return null;

  const trade = trades[index];
  const exitFee = getTradeFee(trade.ticker);
  const grossPnl = (exitPrice - trade.actualEntry) * trade.shares;
  const pnl = grossPnl - exitFee;
  const pnlPercent = (pnl / trade.totalInvested) * 100;

  trades[index] = {
    ...trade,
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
    exitPrice,
    exitFee,
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
    totalFees: trade.fee + exitFee,
  };

  localStorage.setItem(TRADES_KEY, JSON.stringify(trades));

  const currentBalance = getBalance();
  const proceeds = (exitPrice * trade.shares) - exitFee;
  setBalance(parseFloat((currentBalance + proceeds).toFixed(2)));

  return trades[index];
}

export function getStats() {
  const trades = getTrades();
  const closed = trades.filter(t => t.status === 'CLOSED');
  const open = trades.filter(t => t.status === 'OPEN');

  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl <= 0);
  const totalPnl = closed.reduce((sum, t) => sum + t.pnl, 0);
  const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0) + (t.exitFee || 0), 0);
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;
  const avgWin = wins.length > 0 ? (wins.reduce((sum, t) => sum + t.pnlPercent, 0) / wins.length).toFixed(1) : 0;
  const avgLoss = losses.length > 0 ? (losses.reduce((sum, t) => sum + t.pnlPercent, 0) / losses.length).toFixed(1) : 0;

  return {
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    avgWin,
    avgLoss,
    balance: getBalance(),
  };
}

export function resetAll() {
  localStorage.removeItem(TRADES_KEY);
  localStorage.removeItem(BALANCE_KEY);
  localStorage.removeItem(BAGGER_KEY);
}

// 100-Bagger Portfolio
export function getBaggerPortfolio() {
  const stored = localStorage.getItem(BAGGER_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addBaggerPosition(ticker, shares, price, name, sector) {
  const portfolio = getBaggerPortfolio();
  const existing = portfolio.findIndex(p => p.ticker === ticker);

  if (existing >= 0) {
    const pos = portfolio[existing];
    const totalShares = pos.shares + shares;
    const avgPrice = ((pos.avgPrice * pos.shares) + (price * shares)) / totalShares;
    portfolio[existing] = {
      ...pos,
      shares: totalShares,
      avgPrice: parseFloat(avgPrice.toFixed(2)),
      totalInvested: parseFloat((totalShares * avgPrice).toFixed(2)),
      lastAdded: new Date().toISOString(),
      history: [...(pos.history || []), { date: new Date().toISOString(), shares, price, action: 'BUY' }],
    };
  } else {
    portfolio.push({
      id: Date.now(),
      ticker,
      name,
      sector,
      shares,
      avgPrice: price,
      totalInvested: parseFloat((shares * price).toFixed(2)),
      addedAt: new Date().toISOString(),
      lastAdded: new Date().toISOString(),
      targetMultiple: 100,
      history: [{ date: new Date().toISOString(), shares, price, action: 'BUY' }],
    });
  }

  localStorage.setItem(BAGGER_KEY, JSON.stringify(portfolio));
  return portfolio;
}

export function removeBaggerPosition(ticker) {
  const portfolio = getBaggerPortfolio().filter(p => p.ticker !== ticker);
  localStorage.setItem(BAGGER_KEY, JSON.stringify(portfolio));
  return portfolio;
}

export function getBaggerSignal(position, currentPrice) {
  const changeFromAvg = ((currentPrice - position.avgPrice) / position.avgPrice) * 100;
  const targetPrice = position.avgPrice * position.targetMultiple;
  const progressTo100x = (currentPrice / targetPrice) * 100;

  if (changeFromAvg <= -25) return { signal: 'BUY MORE', color: 'emerald', reason: `Down ${Math.abs(changeFromAvg).toFixed(1)}% from avg — strong accumulation opportunity` };
  if (changeFromAvg <= -15) return { signal: 'ACCUMULATE', color: 'cyan', reason: `Down ${Math.abs(changeFromAvg).toFixed(1)}% from avg — consider adding` };
  if (changeFromAvg >= 200) return { signal: 'REVIEW', color: 'amber', reason: `Up ${changeFromAvg.toFixed(1)}% — review if thesis still intact` };
  return { signal: 'HOLD', color: 'gray', reason: `On track — ${progressTo100x.toFixed(2)}% of the way to 100x` };
}