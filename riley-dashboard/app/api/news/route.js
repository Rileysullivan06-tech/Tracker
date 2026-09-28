import { NextResponse } from 'next/server';

const decode = (s = '') => s
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/<[^>]*>/g, '')
  .trim();

function tag(item, name) {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

async function feed(url, category, limit) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 RileyDashboard/1.0' },
    next: { revalidate: 900 }
  });
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).map((m, i) => ({
    id: `${category}-${i}-${tag(m[1], 'pubDate')}`,
    category,
    title: tag(m[1], 'title').replace(/\s+-\s+[^-]+$/, ''),
    source: tag(m[1], 'source') || tag(m[1], 'title').split(' - ').at(-1),
    link: tag(m[1], 'link'),
    published: tag(m[1], 'pubDate')
  }));
}

export async function GET() {
  try {
    const topUrl = 'https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en';
    const marketsUrl = 'https://news.google.com/rss/search?q=markets%20stocks%20economy%20Canada&hl=en-CA&gl=CA&ceid=CA:en';
    const [top, markets] = await Promise.all([
      feed(topUrl, 'Top', 6),
      feed(marketsUrl, 'Markets', 5)
    ]);
    return NextResponse.json({ updatedAt: new Date().toISOString(), items: [...top, ...markets] });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'News unavailable', items: [] }, { status: 500 });
  }
}
