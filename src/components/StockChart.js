import React, { useEffect, useRef, useState } from 'react';

const PERIODS = [
  { label: '1D', interval: '5', range: '1D' },
  { label: '1W', interval: '15', range: '5D' },
  { label: '1M', interval: '60', range: '1M' },
  { label: '3M', interval: 'D', range: '3M' },
  { label: '1Y', interval: 'W', range: '12M' },
  { label: '5Y', interval: 'M', range: '60M' },
];

export default function StockChart({ ticker, onClose }) {
  const containerRef = useRef(null);
  const [activePeriod, setActivePeriod] = useState(PERIODS[0]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: activePeriod.interval,
      range: activePeriod.range,
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
    });

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = '100%';
    container.style.width = '100%';

    containerRef.current.appendChild(container);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [ticker, activePeriod]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[600px] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <p className="text-white font-bold text-lg">{ticker}</p>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setActivePeriod(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${activePeriod.label === p.label ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="flex-1 p-2">
          <div ref={containerRef} className="tradingview-widget-container h-full w-full"/>
        </div>
        <p className="text-center text-gray-700 text-xs pb-2">Powered by TradingView</p>
      </div>
    </div>
  );
}