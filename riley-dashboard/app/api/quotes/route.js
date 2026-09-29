import { NextResponse } from 'next/server';

function lastValid(values = []) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return values[i];
  return null;
}

function sample(values, max = 42) {
  const clean = values.filter(v => v != null && Number.isFinite(Number(v))).map(Number);
  if (clean.length <= max) return clean;
  const step = (clean.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => clean[Math.round(i * step)]);
}

async function chart(symbol, range = '1d', interval = '5m') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 RileyDashboard/2.0' },
    next: { revalidate: 300 }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No quote data');
  return result;
}

export async function POST(req) {
  try {
    const { symbols = [] } = await req.json();
    const clean = [...new Set(symbols)].slice(0, 30);
    const rows = await Promise.all(clean.map(async (symbol) => {
      try {
        let result;
        let closes = [];
        let intradayAvailable = false;
        try {
          result = await chart(symbol, '1d', '5m');
          closes = result?.indicators?.quote?.[0]?.close || [];
          intradayAvailable = closes.filter(v => v != null).length >= 2;
        } catch {
          result = await chart(symbol, '5d', '1d');
          closes = result?.indicators?.quote?.[0]?.close || [];
        }
        const meta = result.meta || {};
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
          marketState: meta.marketState || '',
          sparkline: intradayAvailable ? sample(closes) : [],
          intradayAvailable
        };
      } catch (error) {
        return { symbol, error: error.message || 'Quote unavailable', sparkline: [] };
      }
    }));
    return NextResponse.json({ updatedAt: new Date().toISOString(), rows });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Quote request failed' }, { status: 500 });
  }
}
