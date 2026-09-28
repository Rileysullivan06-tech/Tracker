import { NextResponse } from 'next/server';

function lastValid(values = []) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return values[i];
  return null;
}

export async function POST(req) {
  try {
    const { symbols = [] } = await req.json();
    const clean = [...new Set(symbols)].slice(0, 30);
    const rows = await Promise.all(clean.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 RileyDashboard/1.0' },
          next: { revalidate: 300 }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error('No quote data');
        const meta = result.meta || {};
        const closes = result?.indicators?.quote?.[0]?.close || [];
        const price = meta.regularMarketPrice ?? lastValid(closes);
        const previous = meta.chartPreviousClose ?? meta.previousClose ?? closes.filter(v => v != null).at(-2);
        const change = price != null && previous != null ? price - previous : null;
        const changePct = change != null && previous ? (change / previous) * 100 : null;
        return {
          symbol,
          price,
          previous,
          change,
          changePct,
          currency: meta.currency || '',
          exchange: meta.exchangeName || meta.fullExchangeName || '',
          marketState: meta.marketState || ''
        };
      } catch (error) {
        return { symbol, error: error.message || 'Quote unavailable' };
      }
    }));
    return NextResponse.json({ updatedAt: new Date().toISOString(), rows });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Quote request failed' }, { status: 500 });
  }
}
