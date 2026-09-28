'use client';

import { useEffect, useMemo, useState } from 'react';
import { ACADEMIC_EVENTS, COURSES, NO_CLASS_DATES, RECURRING, WATCHLIST } from './data';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return (h === 24 ? 24 * 60 : h * 60 + m); };
const fromMinutes = (date, mins) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60);
const fmtTime = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDate = d => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const fmtLong = d => d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
const hours = ms => Math.round((ms / HOUR) * 10) / 10;

function loadJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function urgency(event, now) {
  if (!event.due) return 'tbd';
  const diff = new Date(event.due) - now;
  if (diff < 0) return 'past';
  if (diff <= DAY) return 'today';
  if (diff <= 3 * DAY) return 'urgent';
  if (diff <= 7 * DAY) return 'week';
  return 'later';
}

function fixedForDate(date) {
  const key = isoDate(date);
  const weekday = date.getDay();
  const items = [];
  for (const r of RECURRING) {
    if (r.weekday !== weekday) continue;
    if (r.kind === 'class' && NO_CLASS_DATES.has(key)) continue;
    items.push({
      ...r,
      startAt: fromMinutes(date, minutes(r.start)),
      endAt: fromMinutes(date, minutes(r.end)),
      fixed: true
    });
  }
  for (const e of ACADEMIC_EVENTS) {
    if (!e.due || isoDate(new Date(e.due)) !== key) continue;
    if (!['midterm', 'quiz', 'assignment', 'final'].includes(e.type) || !e.end) continue;
    items.push({
      id: `assessment-${e.id}`,
      title: e.title,
      course: e.course,
      kind: 'assessment',
      startAt: new Date(e.due),
      endAt: new Date(e.end),
      location: e.location,
      fixed: true
    });
  }
  // When an in-class assessment replaces the normal class block, show only the assessment.
  const assessments = items.filter(x => x.kind === 'assessment');
  return items.filter(x => !(x.kind === 'class' && assessments.some(a => a.course === x.course && a.startAt < x.endAt && a.endAt > x.startAt)))
    .sort((a, b) => a.startAt - b.startAt);
}

function mergeBusy(items, date) {
  const buffer = 20;
  const ranges = items.map(x => ({
    start: Math.max(8 * 60, Math.round((x.startAt - dayStart(date)) / MIN) - buffer),
    end: Math.min(22 * 60, Math.round((x.endAt - dayStart(date)) / MIN) + buffer)
  })).filter(x => x.end > 8 * 60 && x.start < 22 * 60).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    if (!merged.length || r.start > merged.at(-1).end) merged.push({ ...r });
    else merged.at(-1).end = Math.max(merged.at(-1).end, r.end);
  }
  return merged;
}

function freeWindows(date, fixed, dailyScheduledMinutes) {
  const busy = mergeBusy(fixed, date);
  const windows = [];
  let cursor = 8 * 60;
  for (const b of busy) {
    if (b.start - cursor >= 45) windows.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (22 * 60 - cursor >= 45) windows.push({ start: cursor, end: 22 * 60 });
  // Cap study time to keep the schedule realistic; free Fridays/weekends can carry more.
  const cap = [0, 5, 6].includes(date.getDay()) ? 5 * 60 : 3.5 * 60;
  const remainingCap = Math.max(0, cap - dailyScheduledMinutes);
  let left = remainingCap;
  return windows.flatMap(w => {
    if (left < 45) return [];
    const len = Math.min(w.end - w.start, left);
    left -= len;
    return [{ start: w.start, end: w.start + len }];
  });
}

function buildStudyPlan(now, completedEvents, estimateOverrides, completedSessions, studyProgress) {
  const start = dayStart(now);
  const horizon = addDays(start, 14);
  const targets = ACADEMIC_EVENTS
    .filter(e => e.due && new Date(e.due) > now && new Date(e.due) <= horizon && e.estimateHours > 0 && !completedEvents[e.id])
    .map(e => ({ ...e, hoursNeeded: Number(estimateOverrides[e.id] ?? e.estimateHours) }))
    .sort((a, b) => new Date(a.due) - new Date(b.due) || (b.weight || 0) - (a.weight || 0));

  const sessions = [];
  const daily = {};
  let counter = 0;

  for (const target of targets) {
    const deadline = new Date(target.due);
    const cutoff = deadline.getHours() < 15 ? addDays(dayStart(deadline), -1) : dayStart(deadline);
    const completedMinutes = Number(studyProgress[target.id] || 0);
    let remaining = Math.max(0, Math.round(target.hoursNeeded * 60) - completedMinutes);

    const days = [];
    for (let d = start; d <= cutoff; d = addDays(d, 1)) days.push(new Date(d));
    // Spread work: alternate earlier/later days rather than cramming everything into the deadline eve.
    const orderedDays = days.sort((a, b) => {
      const aLoad = daily[isoDate(a)] || 0;
      const bLoad = daily[isoDate(b)] || 0;
      return aLoad - bLoad || a - b;
    });

    for (const date of orderedDays) {
      if (remaining <= 0) break;
      const key = isoDate(date);
      const fixed = fixedForDate(date).concat(sessions.filter(s => isoDate(s.startAt) === key));
      const windows = freeWindows(date, fixed, daily[key] || 0);
      for (const w of windows) {
        if (remaining <= 0) break;
        let cursor = w.start;
        while (cursor + 45 <= w.end && remaining > 0) {
          const duration = Math.min(90, remaining, w.end - cursor);
          if (duration < 45) break;
          const id = `study-${target.id}-${key}-${counter++}`;
          const s = {
            id,
            targetId: target.id,
            course: target.course,
            kind: 'study',
            title: `Study: ${target.title}`,
            startAt: fromMinutes(date, cursor),
            endAt: fromMinutes(date, cursor + duration),
            minutes: duration,
            deadline,
            completed: !!completedSessions[id]
          };
          sessions.push(s);
          daily[key] = (daily[key] || 0) + duration;
          remaining -= duration;
          cursor += duration + 15;
        }
      }
    }
    target.unscheduledMinutes = Math.max(0, remaining);
  }

  return { targets, sessions: sessions.sort((a, b) => a.startAt - b.startAt) };
}

export default function Dashboard() {
  const [now, setNow] = useState(() => new Date());
  const [completedEvents, setCompletedEvents] = useState({});
  const [completedSessions, setCompletedSessions] = useState({});
  const [estimateOverrides, setEstimateOverrides] = useState({});
  const [studyProgress, setStudyProgress] = useState({});
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [quoteStatus, setQuoteStatus] = useState('Loading live prices…');
  const [news, setNews] = useState([]);
  const [newsStatus, setNewsStatus] = useState('Loading headlines…');
  const [activeNews, setActiveNews] = useState('Top');

  useEffect(() => {
    setCompletedEvents(loadJSON('riley.completedEvents', {}));
    setCompletedSessions(loadJSON('riley.completedSessions', {}));
    setEstimateOverrides(loadJSON('riley.estimateOverrides', {}));
    setStudyProgress(loadJSON('riley.studyProgress', {}));
    setTodos(loadJSON('riley.todos', []));
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => localStorage.setItem('riley.completedEvents', JSON.stringify(completedEvents)), [completedEvents]);
  useEffect(() => localStorage.setItem('riley.completedSessions', JSON.stringify(completedSessions)), [completedSessions]);
  useEffect(() => localStorage.setItem('riley.estimateOverrides', JSON.stringify(estimateOverrides)), [estimateOverrides]);
  useEffect(() => localStorage.setItem('riley.studyProgress', JSON.stringify(studyProgress)), [studyProgress]);
  useEffect(() => localStorage.setItem('riley.todos', JSON.stringify(todos)), [todos]);

  async function refreshQuotes() {
    setQuoteStatus('Refreshing…');
    try {
      const res = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols: WATCHLIST.map(x => x.symbol) }) });
      const data = await res.json();
      setQuotes(data.rows || []);
      setQuoteStatus(data.updatedAt ? `Updated ${fmtTime(new Date(data.updatedAt))}` : 'Updated');
    } catch { setQuoteStatus('Live prices unavailable'); }
  }

  async function refreshNews() {
    setNewsStatus('Refreshing…');
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNews(data.items || []);
      setNewsStatus(data.updatedAt ? `Updated ${fmtTime(new Date(data.updatedAt))}` : 'Updated');
    } catch { setNewsStatus('Headlines unavailable'); }
  }

  useEffect(() => { refreshQuotes(); refreshNews(); }, []);

  const plan = useMemo(() => buildStudyPlan(now, completedEvents, estimateOverrides, completedSessions, studyProgress), [now, completedEvents, estimateOverrides, completedSessions, studyProgress]);
  const todayKey = isoDate(now);
  const todayFixed = fixedForDate(now);
  const todayStudy = plan.sessions.filter(s => isoDate(s.startAt) === todayKey);
  const todayItems = [...todayFixed, ...todayStudy].sort((a, b) => a.startAt - b.startAt);

  const upcoming = useMemo(() => ACADEMIC_EVENTS
    .filter(e => e.due && new Date(e.due) >= dayStart(now) && !completedEvents[e.id])
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 9), [now, completedEvents]);

  const weekStart = addDays(dayStart(now), -((now.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStudy = plan.sessions.filter(s => s.startAt >= weekStart && s.startAt < addDays(weekStart, 7));
  const weekWorkHours = weekDays.reduce((sum, d) => sum + fixedForDate(d).filter(x => x.kind === 'work').reduce((a, x) => a + (x.endAt - x.startAt), 0), 0) / HOUR;
  const next14Required = plan.targets.reduce((s, t) => s + t.hoursNeeded, 0);
  const next14Scheduled = plan.sessions.reduce((s, x) => s + x.minutes / 60, 0);
  const next14Unscheduled = plan.targets.reduce((s, t) => s + (t.unscheduledMinutes || 0) / 60, 0);

  const quoteMap = Object.fromEntries(quotes.map(q => [q.symbol, q]));
  const visibleNews = news.filter(n => n.category === activeNews).slice(0, 6);

  function toggleSession(session) {
    const wasDone = !!completedSessions[session.id];
    setCompletedSessions(v => ({ ...v, [session.id]: !wasDone }));
    setStudyProgress(v => ({
      ...v,
      [session.targetId]: Math.max(0, Number(v[session.targetId] || 0) + (wasDone ? -session.minutes : session.minutes))
    }));
  }
  function toggleEvent(id) { setCompletedEvents(v => ({ ...v, [id]: !v[id] })); }
  function addTodo(e) {
    e.preventDefault();
    const value = newTodo.trim();
    if (!value) return;
    setTodos(t => [...t, { id: crypto.randomUUID(), text: value, done: false, createdAt: new Date().toISOString() }]);
    setNewTodo('');
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">PERSONAL COMMAND CENTER</div>
          <h1>Riley Dashboard</h1>
          <p className="muted">{fmtLong(now)} · {fmtTime(now)}</p>
        </div>
        <div className="headerActions">
          <button className="ghost" onClick={() => { refreshQuotes(); refreshNews(); setNow(new Date()); }}>↻ Refresh live data</button>
          <div className={`statusDot ${next14Unscheduled > 0 ? 'warn' : ''}`}>{next14Unscheduled > 0 ? `${next14Unscheduled.toFixed(1)}h needs placement` : 'Planner balanced'}</div>
        </div>
      </header>

      <section className="stats">
        <Stat label="Today" value={`${todayItems.length} blocks`} sub={`${todayStudy.reduce((s, x) => s + x.minutes, 0) / 60 || 0}h study planned`} />
        <Stat label="Next 14 days" value={`${next14Required.toFixed(1)}h`} sub="estimated school workload" />
        <Stat label="Auto-scheduled" value={`${next14Scheduled.toFixed(1)}h`} sub={next14Unscheduled ? `${next14Unscheduled.toFixed(1)}h still unscheduled` : 'all estimated work placed'} tone={next14Unscheduled ? 'warn' : 'good'} />
        <Stat label="Work this week" value={`${weekWorkHours.toFixed(1)}h`} sub="fixed recurring shifts" />
      </section>

      <section className="grid heroGrid">
        <div className="card span2">
          <CardTitle title="Today" subtitle="Classes, work, assessments, and generated study blocks" />
          <div className="timeline">
            {todayItems.length === 0 && <Empty text="Nothing fixed today. The planner will use this as open study time." />}
            {todayItems.map(item => <TimelineItem key={item.id} item={item} complete={item.kind === 'study' && completedSessions[item.id]} onToggle={item.kind === 'study' ? () => toggleSession(item) : null} />)}
          </div>
        </div>

        <div className="card">
          <CardTitle title="Upcoming" subtitle="Verified course deadlines" />
          <div className="deadlineList">
            {upcoming.map(e => {
              const u = urgency(e, now);
              return <div className={`deadline ${u}`} key={e.id}>
                <button className="check" onClick={() => toggleEvent(e.id)} aria-label="mark complete">○</button>
                <div className="deadlineMain">
                  <div className="row"><span className="courseTag" style={{ '--tag': COURSES[e.course].color }}>{COURSES[e.course].code}</span><span className="tiny">{e.weight ? `${e.weight}%` : e.type}</span></div>
                  <strong>{e.title}</strong>
                  <span>{fmtDate(new Date(e.due))} · {fmtTime(new Date(e.due))}</span>
                </div>
              </div>;
            })}
          </div>
        </div>
      </section>

      <section className="card plannerCard">
        <CardTitle title="Smart Study Planner" subtitle="Estimates workload, then fits sessions around class + work with buffer time" />
        <div className="plannerSummary">
          <div><b>{plan.targets.length}</b><span>upcoming items</span></div>
          <div><b>{next14Required.toFixed(1)}h</b><span>estimated</span></div>
          <div><b>{next14Scheduled.toFixed(1)}h</b><span>scheduled</span></div>
          <div className={next14Unscheduled ? 'dangerText' : ''}><b>{next14Unscheduled.toFixed(1)}h</b><span>unscheduled</span></div>
        </div>
        <div className="targets">
          {plan.targets.map(t => <div className="target" key={t.id}>
            <div>
              <span className="courseTag" style={{ '--tag': COURSES[t.course].color }}>{COURSES[t.course].code}</span>
              <strong>{t.title}</strong>
              <small>Due {fmtDate(new Date(t.due))} · {t.weight ? `${t.weight}%` : t.type} · {(Number(studyProgress[t.id] || 0) / 60).toFixed(1)}h completed</small>
            </div>
            <label className="estimate">Estimate
              <input type="number" min="0.5" max="30" step="0.5" value={estimateOverrides[t.id] ?? t.estimateHours} onChange={e => setEstimateOverrides(v => ({ ...v, [t.id]: e.target.value }))} />
              <span>h</span>
            </label>
            <div className={`placement ${t.unscheduledMinutes ? 'bad' : 'ok'}`}>{t.unscheduledMinutes ? `${(t.unscheduledMinutes / 60).toFixed(1)}h unplaced` : 'Fully placed'}</div>
          </div>)}
        </div>
      </section>

      <section className="card">
        <CardTitle title="This Week" subtitle="Fixed schedule + automatically generated study sessions" />
        <div className="weekGrid">
          {weekDays.map(d => {
            const key = isoDate(d);
            const items = [...fixedForDate(d), ...plan.sessions.filter(s => isoDate(s.startAt) === key)].sort((a, b) => a.startAt - b.startAt);
            return <div className={`dayCol ${key === todayKey ? 'todayCol' : ''}`} key={key}>
              <div className="dayHead"><span>{d.toLocaleDateString([], { weekday: 'short' })}</span><b>{d.getDate()}</b></div>
              <div className="dayItems">
                {items.length === 0 && <span className="openDay">Open</span>}
                {items.map(item => <div key={item.id} className={`calBlock ${item.kind}`} style={item.course ? { '--block': COURSES[item.course].color } : {}}>
                  <span>{fmtTime(item.startAt)}</span><strong>{item.title.replace(/^Study: /, '')}</strong>{item.kind === 'study' && <em>study</em>}
                </div>)}
              </div>
            </div>;
          })}
        </div>
      </section>

      <section className="grid lowerGrid">
        <div className="card">
          <CardTitle title="To‑Do" subtitle="Personal tasks are saved in this browser" />
          <form className="todoForm" onSubmit={addTodo}><input value={newTodo} onChange={e => setNewTodo(e.target.value)} placeholder="Add a task…" /><button>Add</button></form>
          <div className="todoList">
            {todos.length === 0 && <Empty text="No personal tasks yet." />}
            {todos.map(t => <div className={`todo ${t.done ? 'done' : ''}`} key={t.id}>
              <button className="check" onClick={() => setTodos(xs => xs.map(x => x.id === t.id ? { ...x, done: !x.done } : x))}>{t.done ? '✓' : '○'}</button>
              <span>{t.text}</span>
              <button className="delete" onClick={() => setTodos(xs => xs.filter(x => x.id !== t.id))}>×</button>
            </div>)}
          </div>
        </div>

        <div className="card span2">
          <CardTitle title="Portfolio Watchlist" subtitle={quoteStatus} action={<button className="linkBtn" onClick={refreshQuotes}>Refresh</button>} />
          <div className="watchTable">
            <div className="watchHead"><span>Symbol</span><span>Price</span><span>Day</span><span>Currency</span></div>
            {WATCHLIST.map(w => {
              const q = quoteMap[w.symbol] || {};
              return <div className="watchRow" key={w.symbol}>
                <div><strong>{w.label}</strong><small>{w.note || w.asset}</small></div>
                <span>{q.price != null ? Number(q.price).toLocaleString(undefined, { maximumFractionDigits: q.price < 5 ? 4 : 2 }) : q.error ? '—' : '…'}</span>
                <span className={q.changePct == null ? '' : q.changePct >= 0 ? 'up' : 'down'}>{q.changePct == null ? '—' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}</span>
                <span className="muted">{q.currency || '—'}</span>
              </div>;
            })}
          </div>
          <p className="fineprint">Watchlist only — no brokerage connection or trading. Market feeds can be delayed or temporarily unavailable.</p>
        </div>
      </section>

      <section className="card">
        <CardTitle title="Daily News" subtitle={newsStatus} action={<div className="seg"><button className={activeNews === 'Top' ? 'active' : ''} onClick={() => setActiveNews('Top')}>Top</button><button className={activeNews === 'Markets' ? 'active' : ''} onClick={() => setActiveNews('Markets')}>Markets</button></div>} />
        <div className="newsGrid">
          {visibleNews.length === 0 && <Empty text="Live headlines will appear here when the deployed app can reach the news feed." />}
          {visibleNews.map(n => <a className="newsItem" href={n.link} target="_blank" rel="noreferrer" key={n.id}><span>{n.category}</span><strong>{n.title}</strong><small>{n.source || 'News'} · {n.published ? new Date(n.published).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</small></a>)}
        </div>
      </section>

      <footer>Academic dates are preloaded from your Fall 2026 outlines. D2L-only participation/reading dates and registrar-set final dates remain intentionally unfilled until known.</footer>
    </main>
  );
}

function Stat({ label, value, sub, tone = '' }) { return <div className={`stat ${tone}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>; }
function CardTitle({ title, subtitle, action }) { return <div className="cardTitle"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }
function TimelineItem({ item, complete, onToggle }) {
  const color = item.course ? COURSES[item.course].color : item.kind === 'work' ? '#ef4444' : '#64748b';
  return <div className={`timelineItem ${complete ? 'complete' : ''}`}>
    <div className="time">{fmtTime(item.startAt)}<span>{fmtTime(item.endAt)}</span></div>
    <div className="line"><i style={{ background: color }} /></div>
    <div className="eventBody"><div className="row"><strong>{item.title}</strong>{item.kind === 'study' && <span className="pill">AUTO STUDY</span>}</div><span>{item.location || (item.kind === 'work' ? 'Recurring shift' : item.kind === 'study' ? `${hours(item.endAt - item.startAt)}h focus block` : '')}</span></div>
    {onToggle && <button className="sessionCheck" onClick={onToggle}>{complete ? '✓' : 'Done'}</button>}
  </div>;
}
