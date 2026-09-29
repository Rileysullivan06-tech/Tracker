'use client';

import { useEffect, useMemo, useState } from 'react';
import SmartCalendar from './components/Calendar';
import { ACADEMIC_EVENTS, COURSES, WATCHLIST } from './data';
import {
  MIN,
  addDays,
  academicDeadlinesForRange,
  buildStudyPlan,
  conflictsForManualStudies,
  countdown,
  dayStart,
  expandCustomEvents,
  fixedForDate,
  fmtDate,
  fmtLong,
  fmtTime,
  formatDuration,
  freePeriodsForDay,
  fromMinutes,
  isoDate,
  minutes,
  urgency
} from './lib/scheduler';

const DEFAULT_PREFS = {
  preferredTime: 'balanced',
  earliest: '08:00',
  latest: '22:00',
  maxSessionMinutes: 90,
  minBreakMinutes: 15,
  bufferMinutes: 20,
  lightWeekends: false,
  weekdayCapMinutes: 210,
  weekendCapMinutes: 300
};

const DEFAULT_PINS = ['NVDA', 'GOOG', 'VOO', 'BTC-USD'];

function loadJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function localTimeString(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function percentDone(done, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function findAcademic(id) {
  return ACADEMIC_EVENTS.find(e => e.id === id);
}

export default function Dashboard() {
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [completedEvents, setCompletedEvents] = useState({});
  const [completedSessions, setCompletedSessions] = useState({});
  const [estimateOverrides, setEstimateOverrides] = useState({});
  const [studyProgress, setStudyProgress] = useState({});
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [customEvents, setCustomEvents] = useState([]);
  const [manualStudy, setManualStudy] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [plannerPrefs, setPlannerPrefs] = useState(DEFAULT_PREFS);
  const [pinnedSymbols, setPinnedSymbols] = useState(DEFAULT_PINS);
  const [quotes, setQuotes] = useState([]);
  const [quoteStatus, setQuoteStatus] = useState('Loading live prices…');
  const [news, setNews] = useState([]);
  const [newsStatus, setNewsStatus] = useState('Loading headlines…');
  const [activeNews, setActiveNews] = useState('Top');
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_PINS[0]);
  const [calendarView, setCalendarView] = useState('week');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDraft, setEventDraft] = useState(null);
  const [showPlannerSettings, setShowPlannerSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [replanVersion, setReplanVersion] = useState(0);

  useEffect(() => {
    setCompletedEvents(loadJSON('riley.completedEvents', {}));
    setCompletedSessions(loadJSON('riley.completedSessions', {}));
    setEstimateOverrides(loadJSON('riley.estimateOverrides', {}));
    setStudyProgress(loadJSON('riley.studyProgress', {}));
    setTodos(loadJSON('riley.todos', []));
    setCustomEvents(loadJSON('riley.customEvents', []));
    setManualStudy(loadJSON('riley.manualStudy', []));
    setBlackouts(loadJSON('riley.studyBlackouts', []));
    setPlannerPrefs({ ...DEFAULT_PREFS, ...loadJSON('riley.plannerPrefs', {}) });
    setPinnedSymbols(loadJSON('riley.pinnedSymbols', DEFAULT_PINS));
    setHydrated(true);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem('riley.completedEvents', JSON.stringify(completedEvents)); }, [hydrated, completedEvents]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.completedSessions', JSON.stringify(completedSessions)); }, [hydrated, completedSessions]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.estimateOverrides', JSON.stringify(estimateOverrides)); }, [hydrated, estimateOverrides]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.studyProgress', JSON.stringify(studyProgress)); }, [hydrated, studyProgress]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.todos', JSON.stringify(todos)); }, [hydrated, todos]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.customEvents', JSON.stringify(customEvents)); }, [hydrated, customEvents]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.manualStudy', JSON.stringify(manualStudy)); }, [hydrated, manualStudy]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.studyBlackouts', JSON.stringify(blackouts)); }, [hydrated, blackouts]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.plannerPrefs', JSON.stringify(plannerPrefs)); }, [hydrated, plannerPrefs]);
  useEffect(() => { if (hydrated) localStorage.setItem('riley.pinnedSymbols', JSON.stringify(pinnedSymbols)); }, [hydrated, pinnedSymbols]);

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

  useEffect(() => {
    refreshQuotes();
    refreshNews();
    const quoteTimer = setInterval(refreshQuotes, 5 * 60_000);
    const newsTimer = setInterval(refreshNews, 15 * 60_000);
    return () => { clearInterval(quoteTimer); clearInterval(newsTimer); };
  }, []);

  const plan = useMemo(() => buildStudyPlan({
    now,
    completedEvents,
    estimateOverrides,
    studyProgress,
    customEvents,
    manualStudy,
    blackouts,
    prefs: plannerPrefs
  }), [now, completedEvents, estimateOverrides, studyProgress, customEvents, manualStudy, blackouts, plannerPrefs, replanVersion]);

  const rangeStart = useMemo(() => addDays(dayStart(calendarDate), -45), [calendarDate]);
  const rangeEnd = useMemo(() => addDays(dayStart(calendarDate), 100), [calendarDate]);
  const fixedEvents = useMemo(() => {
    const out = [];
    for (let d = rangeStart; d < rangeEnd; d = addDays(d, 1)) out.push(...fixedForDate(d));
    return out;
  }, [rangeStart, rangeEnd]);
  const customInstances = useMemo(() => expandCustomEvents(customEvents, rangeStart, rangeEnd), [customEvents, rangeStart, rangeEnd]);
  const deadlineEvents = useMemo(() => academicDeadlinesForRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const manualStudyEvents = useMemo(() => manualStudy.map(s => ({ ...s, startAt: new Date(s.startAt), endAt: new Date(s.endAt), source: 'manual-study', kind: 'study', manualPositioned: true })), [manualStudy]);
  const calendarEvents = useMemo(() => [...fixedEvents, ...customInstances, ...deadlineEvents, ...manualStudyEvents, ...plan.sessions], [fixedEvents, customInstances, deadlineEvents, manualStudyEvents, plan.sessions]);

  const conflicts = useMemo(() => conflictsForManualStudies(manualStudy, customEvents, rangeStart, rangeEnd), [manualStudy, customEvents, rangeStart, rangeEnd]);
  const next14RequiredMinutes = plan.targets.reduce((s, t) => s + t.hoursNeeded * 60, 0);
  const next14AutoMinutes = plan.sessions.reduce((s, x) => s + x.minutes, 0);
  const next14ManualMinutes = manualStudy.filter(s => !s.completed && new Date(s.startAt) >= dayStart(now) && new Date(s.startAt) <= addDays(dayStart(now), 14)).reduce((s, x) => s + (new Date(x.endAt) - new Date(x.startAt)) / MIN, 0);
  const next14Unscheduled = plan.targets.reduce((s, t) => s + (t.unscheduledMinutes || 0), 0);

  const todayKey = isoDate(now);
  const todayItems = calendarEvents
    .filter(e => isoDate(new Date(e.startAt)) === todayKey && e.kind !== 'deadline')
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const currentItem = todayItems.find(e => new Date(e.startAt) <= now && new Date(e.endAt) > now);
  const nextItem = todayItems.find(e => new Date(e.startAt) > now);
  const remainingToday = todayItems.filter(e => new Date(e.endAt) > now).slice(0, 5);
  const freeToday = freePeriodsForDay(now, todayItems).filter(w => fromMinutes(now, w.end) > now);

  const upcoming = useMemo(() => ACADEMIC_EVENTS
    .filter(e => e.due && new Date(e.due) >= dayStart(now) && !completedEvents[e.id])
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 7), [now, completedEvents]);

  const quoteMap = useMemo(() => Object.fromEntries(quotes.map(q => [q.symbol, q])), [quotes]);
  const pinned = WATCHLIST.filter(w => pinnedSymbols.includes(w.symbol));
  const visibleNews = news.filter(n => n.category === activeNews).slice(0, 6);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function addTodo(e) {
    e.preventDefault();
    const value = newTodo.trim();
    if (!value) return;
    setTodos(t => [...t, { id: crypto.randomUUID(), text: value, done: false, createdAt: new Date().toISOString() }]);
    setNewTodo('');
  }

  function toggleEventComplete(id) {
    setCompletedEvents(v => ({ ...v, [id]: !v[id] }));
  }

  function toggleAutoSession(session) {
    const wasDone = !!completedSessions[session.id];
    setCompletedSessions(v => ({ ...v, [session.id]: !wasDone }));
    setStudyProgress(v => ({
      ...v,
      [session.targetId]: Math.max(0, Number(v[session.targetId] || 0) + (wasDone ? -session.minutes : session.minutes))
    }));
    setSelectedEvent(null);
  }

  function toggleManualComplete(study) {
    const duration = Math.round((new Date(study.endAt) - new Date(study.startAt)) / MIN);
    setManualStudy(items => items.map(x => x.id === study.id ? { ...x, completed: !x.completed } : x));
    setStudyProgress(v => ({
      ...v,
      [study.targetId]: Math.max(0, Number(v[study.targetId] || 0) + (study.completed ? -duration : duration))
    }));
    setSelectedEvent(null);
  }

  function addBlackoutFor(event) {
    const id = `blackout-${event.id}`;
    setBlackouts(xs => xs.some(x => x.id === id) ? xs : [...xs, { id, targetId: event.targetId, startAt: new Date(event.startAt).toISOString(), endAt: new Date(event.endAt).toISOString() }]);
    return id;
  }

  function manualizeAuto(event, startAt, endAt, locked = false) {
    const originBlackoutId = addBlackoutFor(event);
    const study = {
      id: crypto.randomUUID(),
      targetId: event.targetId,
      course: event.course,
      title: event.title,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      locked,
      manualPositioned: true,
      completed: false,
      originBlackoutId
    };
    setManualStudy(xs => [...xs, study]);
    return study;
  }

  function overlappingEvent(startAt, endAt, eventId) {
    return calendarEvents.find(e => {
      if (e.id === eventId || e.instanceId === eventId || e.kind === 'deadline') return false;
      const a = new Date(e.startAt), b = new Date(e.endAt);
      return startAt < b && endAt > a;
    });
  }

  function confirmConflict(startAt, endAt, eventId) {
    const conflict = overlappingEvent(startAt, endAt, eventId);
    if (!conflict) return true;
    const constraint = conflict.locked ? 'locked event' : 'existing event';
    return window.confirm(`This overlaps an ${constraint}: ${conflict.title}. Move it anyway?`);
  }

  function moveCalendarEvent(event, date, startMinute) {
    const duration = Math.round((new Date(event.endAt) - new Date(event.startAt)) / MIN);
    const safeStartMinute = Math.min(startMinute, 24 * 60 - duration);
    const startAt = fromMinutes(date, safeStartMinute);
    const endAt = new Date(startAt.getTime() + duration * MIN);
    if (!confirmConflict(startAt, endAt, event.instanceId || event.id)) return;

    if (event.source === 'planner') {
      const study = manualizeAuto(event, startAt, endAt, false);
      showToast('Study block moved and preserved as a manual preference.');
      setSelectedEvent({ ...study, source: 'manual-study', kind: 'study' });
      return;
    }
    if (event.source === 'manual-study') {
      setManualStudy(xs => xs.map(x => x.id === event.id ? { ...x, startAt: startAt.toISOString(), endAt: endAt.toISOString(), manualPositioned: true } : x));
      showToast('Study block moved.');
      return;
    }
    if (event.source === 'custom') {
      setCustomEvents(xs => xs.map(x => x.id === event.id ? { ...x, date: isoDate(startAt), start: localTimeString(startAt), end: localTimeString(endAt) } : x));
      showToast('Event moved.');
    }
  }

  function resizeCalendarEvent(event, newMinutes) {
    const startAt = new Date(event.startAt);
    const endAt = new Date(startAt.getTime() + newMinutes * MIN);
    if (!confirmConflict(startAt, endAt, event.instanceId || event.id)) return;
    if (event.source === 'planner') {
      manualizeAuto(event, startAt, endAt, false);
      showToast('Study duration changed; remaining workload will be replanned.');
      setSelectedEvent(null);
      return;
    }
    if (event.source === 'manual-study') {
      setManualStudy(xs => xs.map(x => x.id === event.id ? { ...x, endAt: endAt.toISOString() } : x));
      showToast('Study duration updated.');
      return;
    }
    if (event.source === 'custom') {
      setCustomEvents(xs => xs.map(x => x.id === event.id ? { ...x, end: localTimeString(endAt) } : x));
      showToast('Event duration updated.');
    }
  }

  function deleteCalendarEvent(event) {
    if (event.source === 'planner') {
      addBlackoutFor(event);
      showToast('Study block removed; missing time will be placed elsewhere if possible.');
    } else if (event.source === 'manual-study') {
      setManualStudy(xs => xs.filter(x => x.id !== event.id));
      showToast('Manual study block removed.');
    } else if (event.source === 'custom') {
      setCustomEvents(xs => xs.filter(x => x.id !== event.id));
      showToast('Event deleted.');
    }
    setSelectedEvent(null);
  }

  function lockAuto(event) {
    manualizeAuto(event, new Date(event.startAt), new Date(event.endAt), true);
    showToast('Study block locked.');
    setSelectedEvent(null);
  }

  function returnManualToAuto(event) {
    setManualStudy(xs => xs.filter(x => x.id !== event.id));
    if (event.originBlackoutId) setBlackouts(xs => xs.filter(x => x.id !== event.originBlackoutId));
    showToast('Block returned to automatic planning.');
    setSelectedEvent(null);
  }

  function openNewEvent(date, startMinute) {
    const start = fromMinutes(date, startMinute);
    const end = new Date(start.getTime() + 60 * MIN);
    setEventDraft({ id: null, title: '', date: isoDate(start), start: localTimeString(start), end: localTimeString(end), category: 'personal', locked: false, recurrence: { freq: 'none', weekdays: [start.getDay()] } });
  }

  function saveEventDraft(draft) {
    if (!draft.title.trim()) return;
    if (minutes(draft.end) <= minutes(draft.start)) {
      window.alert('End time must be after the start time.');
      return;
    }
    const payload = { ...draft, title: draft.title.trim(), kind: draft.category || 'personal' };
    if (draft.id) setCustomEvents(xs => xs.map(x => x.id === draft.id ? payload : x));
    else setCustomEvents(xs => [...xs, { ...payload, id: crypto.randomUUID() }]);
    setEventDraft(null);
    setSelectedEvent(null);
    showToast(draft.id ? 'Event updated.' : 'Event added.');
  }

  function togglePin(symbol) {
    setPinnedSymbols(xs => xs.includes(symbol) ? xs.filter(s => s !== symbol) : [...xs, symbol]);
  }

  function replan() {
    setReplanVersion(v => v + 1);
    showToast('Automatic study plan recalculated around your current constraints.');
  }

  return <main className="appShell">
    {toast && <div className="toast">{toast}</div>}

    <header className="topbar">
      <div>
        <div className="eyebrow">PERSONAL COMMAND CENTER</div>
        <h1>Riley Dashboard</h1>
        <p>{fmtLong(now)} · {fmtTime(now)}</p>
      </div>
      <div className="topActions">
        <button className="quietButton" onClick={() => { refreshQuotes(); refreshNews(); setNow(new Date()); }}>Refresh live data</button>
        <span className={`syncState ${next14Unscheduled > 0 || conflicts.length ? 'warn' : ''}`}><i />{conflicts.length ? `${conflicts.length} schedule conflict${conflicts.length > 1 ? 's' : ''}` : next14Unscheduled > 0 ? `${formatDuration(next14Unscheduled)} unplaced` : 'Planner balanced'}</span>
      </div>
    </header>

    <section className="statusStrip">
      <Metric label="Today" value={currentItem ? `Now · ${currentItem.title.replace(/^Study:\s*/, '')}` : nextItem ? `Next · ${fmtTime(nextItem.startAt)}` : 'Open'} />
      <Metric label="Next 14 days" value={`${formatDuration(next14RequiredMinutes, true)} workload`} />
      <Metric label="Study placed" value={`${formatDuration(next14AutoMinutes + next14ManualMinutes, true)}${next14Unscheduled ? ` · ${formatDuration(next14Unscheduled, true)} open` : ''}`} warn={next14Unscheduled > 0} />
      <Metric label="Live data" value={`${quoteStatus} · ${newsStatus}`} />
    </section>

    <section className="commandGrid">
      <div className="commandColumn">
        <CompactToday now={now} currentItem={currentItem} nextItem={nextItem} remaining={remainingToday} freePeriods={freeToday} onSelectEvent={setSelectedEvent} />
        <UpcomingPanel upcoming={upcoming} now={now} plan={plan} studyProgress={studyProgress} estimateOverrides={estimateOverrides} manualStudy={manualStudy} onComplete={toggleEventComplete} onEstimate={(id, value) => setEstimateOverrides(v => ({ ...v, [id]: value }))} />
      </div>

      <div className="commandColumn">
        <MarketsPanel watchlist={WATCHLIST} pinned={pinned} quoteMap={quoteMap} pinnedSymbols={pinnedSymbols} togglePin={togglePin} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} status={quoteStatus} refresh={refreshQuotes} />
        <NewsPanel items={visibleNews} active={activeNews} setActive={setActiveNews} status={newsStatus} />
      </div>
    </section>

    <SmartCalendar
      view={calendarView}
      setView={setCalendarView}
      anchorDate={calendarDate}
      setAnchorDate={setCalendarDate}
      events={calendarEvents}
      onSelectEvent={setSelectedEvent}
      onMoveEvent={moveCalendarEvent}
      onResizeEvent={resizeCalendarEvent}
      onCreateAt={openNewEvent}
      onOpenPreferences={() => setShowPlannerSettings(true)}
      onReplan={replan}
      plannerStatus={{ warn: next14Unscheduled > 0 || conflicts.length > 0, text: conflicts.length ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}` : next14Unscheduled > 0 ? `${formatDuration(next14Unscheduled)} unplaced` : 'Study plan balanced' }}
    />

    <section className="utilityGrid">
      <TodoPanel todos={todos} setTodos={setTodos} newTodo={newTodo} setNewTodo={setNewTodo} addTodo={addTodo} />
      <PlannerPanel plan={plan} studyProgress={studyProgress} estimateOverrides={estimateOverrides} setEstimateOverrides={setEstimateOverrides} manualStudy={manualStudy} />
    </section>

    <footer>Academic dates remain sourced from the Fall 2026 course outlines. D2L-only dates and registrar-set final dates stay intentionally unfilled until known.</footer>

    {selectedEvent && <EventDetail event={selectedEvent} completedSessions={completedSessions} onClose={() => setSelectedEvent(null)} onDelete={deleteCalendarEvent} onAutoComplete={toggleAutoSession} onManualComplete={toggleManualComplete} onLockAuto={lockAuto} onToggleManualLock={event => { setManualStudy(xs => xs.map(x => x.id === event.id ? { ...x, locked: !x.locked } : x)); setSelectedEvent({ ...event, locked: !event.locked }); }} onReturnToAuto={returnManualToAuto} onEditCustom={event => setEventDraft(customEvents.find(x => x.id === event.id) || null)} />}
    {eventDraft && <EventEditor draft={eventDraft} setDraft={setEventDraft} onSave={saveEventDraft} onClose={() => setEventDraft(null)} />}
    {showPlannerSettings && <PlannerSettings prefs={plannerPrefs} setPrefs={setPlannerPrefs} onClose={() => setShowPlannerSettings(false)} />}
  </main>;
}

function Metric({ label, value, warn }) {
  return <div className={`metric ${warn ? 'warn' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function CompactToday({ now, currentItem, nextItem, remaining, freePeriods, onSelectEvent }) {
  return <section className="panel todayPanel">
    <PanelHead title="Today" subtitle="Now, next, and the rest of your day" />
    <div className="todayLead">
      <div className="nowCard">
        <span className="kicker">{currentItem ? 'NOW' : 'CURRENT'}</span>
        <strong>{currentItem ? currentItem.title.replace(/^Study:\s*/, '') : 'No active block'}</strong>
        <small>{currentItem ? `${fmtTime(currentItem.startAt)}–${fmtTime(currentItem.endAt)}` : nextItem ? `Next at ${fmtTime(nextItem.startAt)}` : 'Nothing else fixed today'}</small>
      </div>
      {nextItem && <button className="nextCard" onClick={() => onSelectEvent(nextItem)}><span>NEXT</span><b>{fmtTime(nextItem.startAt)}</b><strong>{nextItem.title.replace(/^Study:\s*/, '')}</strong></button>}
    </div>
    <div className="compactTimeline">
      {remaining.length === 0 && <div className="emptyCompact">Your remaining day is open.</div>}
      {remaining.map(item => <button className={`compactEvent ${new Date(item.endAt) < now ? 'past' : ''}`} key={item.instanceId || item.id} onClick={() => onSelectEvent(item)}>
        <span>{fmtTime(item.startAt)}</span><i style={{ '--dot': item.course ? COURSES[item.course].color : item.kind === 'work' ? '#f06464' : '#7f93a7' }} /><strong>{item.title.replace(/^Study:\s*/, '')}</strong><em>{formatDuration((new Date(item.endAt) - new Date(item.startAt)) / MIN)}</em>
      </button>)}
    </div>
    {freePeriods.length > 0 && <div className="freeStrip"><span>Open windows</span>{freePeriods.slice(0, 3).map((w, i) => <b key={i}>{fmtTime(fromMinutes(now, w.start))}–{fmtTime(fromMinutes(now, w.end))} · {formatDuration(w.end - w.start)}</b>)}</div>}
  </section>;
}

function UpcomingPanel({ upcoming, now, plan, studyProgress, estimateOverrides, manualStudy, onComplete, onEstimate }) {
  const targetMap = Object.fromEntries(plan.targets.map(t => [t.id, t]));
  return <section className="panel">
    <PanelHead title="Upcoming" subtitle="Deadlines connected to your study plan" />
    <div className="upcomingList">
      {upcoming.map(e => {
        const target = targetMap[e.id];
        const total = Number(estimateOverrides[e.id] ?? e.estimateHours ?? 0) * 60;
        const done = Number(studyProgress[e.id] || 0);
        const manualPlanned = manualStudy.filter(s => s.targetId === e.id && !s.completed).reduce((sum, s) => sum + (new Date(s.endAt) - new Date(s.startAt)) / MIN, 0);
        const autoPlanned = plan.sessions.filter(s => s.targetId === e.id).reduce((sum, s) => sum + s.minutes, 0);
        const remaining = Math.max(0, total - done);
        const u = urgency(e, now);
        return <div className={`upcomingRow ${u}`} key={e.id}>
          <button className="circleCheck" onClick={() => onComplete(e.id)}>○</button>
          <div className="upcomingMain">
            <div className="upcomingMeta"><span className="courseTag" style={{ '--tag': COURSES[e.course].color }}>{COURSES[e.course].code}</span>{e.weight ? <b>{e.weight}%</b> : null}<span>{countdown(e.due, now)}</span></div>
            <strong>{e.title}</strong>
            <div className="progressLine"><span style={{ width: `${percentDone(done, total)}%` }} /></div>
            <small>{total ? `${formatDuration(done)} complete · ${formatDuration(remaining)} remaining · ${formatDuration(autoPlanned + manualPlanned)} scheduled` : `${fmtDate(e.due)} · ${fmtTime(e.due)}`}{target?.unscheduledMinutes ? ` · ${formatDuration(target.unscheduledMinutes)} unplaced` : ''}</small>
          </div>
          {total > 0 && <label className="miniEstimate"><input type="number" min="0.5" max="30" step="0.5" value={estimateOverrides[e.id] ?? e.estimateHours} onChange={ev => onEstimate(e.id, ev.target.value)} /><span>h</span></label>}
        </div>;
      })}
    </div>
  </section>;
}

function MarketsPanel({ watchlist, pinned, quoteMap, pinnedSymbols, togglePin, selectedSymbol, setSelectedSymbol, status, refresh }) {
  const selected = watchlist.find(w => w.symbol === selectedSymbol) || pinned[0] || watchlist[0];
  const selectedQuote = selected ? quoteMap[selected.symbol] || {} : {};
  return <section className="panel marketsPanel">
    <PanelHead title="Markets" subtitle={status} action={<button className="textButton" onClick={refresh}>Refresh</button>} />
    <div className="pinnedGrid">
      {pinned.slice(0, 6).map(w => {
        const q = quoteMap[w.symbol] || {};
        return <button className={`stockTile ${selected?.symbol === w.symbol ? 'selected' : ''}`} key={w.symbol} onClick={() => setSelectedSymbol(w.symbol)}>
          <div className="stockTileTop"><strong>{w.label}</strong><span>{q.currency || ''}</span></div>
          <b>{q.price != null ? Number(q.price).toLocaleString(undefined, { maximumFractionDigits: q.price < 5 ? 4 : 2 }) : '—'}</b>
          <span className={q.changePct == null ? '' : q.changePct >= 0 ? 'up' : 'down'}>{q.changePct == null ? '—' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}</span>
          <Sparkline values={q.sparkline || []} positive={(q.changePct || 0) >= 0} />
        </button>;
      })}
    </div>
    {selected && <div className="stockDetail">
      <div><span>SELECTED</span><strong>{selected.label}</strong><small>{selected.note || selected.asset}</small></div>
      <div className="stockBigPrice"><b>{selectedQuote.price != null ? Number(selectedQuote.price).toLocaleString(undefined, { maximumFractionDigits: selectedQuote.price < 5 ? 4 : 2 }) : '—'}</b><span className={selectedQuote.changePct == null ? '' : selectedQuote.changePct >= 0 ? 'up' : 'down'}>{selectedQuote.changePct == null ? 'Price unavailable' : `${selectedQuote.changePct >= 0 ? '+' : ''}${selectedQuote.changePct.toFixed(2)}% today`}</span></div>
      <Sparkline values={selectedQuote.sparkline || []} positive={(selectedQuote.changePct || 0) >= 0} large />
    </div>}
    <details className="watchlistDrawer">
      <summary>Watchlist · {watchlist.length} symbols</summary>
      <div className="watchlistCompact">
        {watchlist.map(w => {
          const q = quoteMap[w.symbol] || {};
          const isPinned = pinnedSymbols.includes(w.symbol);
          return <div key={w.symbol}><button className="pinButton" onClick={() => togglePin(w.symbol)}>{isPinned ? 'Pinned' : 'Pin'}</button><button className="symbolButton" onClick={() => setSelectedSymbol(w.symbol)}><strong>{w.label}</strong><small>{q.currency || w.note || ''}</small></button><span>{q.price != null ? Number(q.price).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</span><span className={q.changePct == null ? '' : q.changePct >= 0 ? 'up' : 'down'}>{q.changePct == null ? '—' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}</span></div>;
        })}
      </div>
    </details>
  </section>;
}

function Sparkline({ values, positive, large = false }) {
  if (!values || values.length < 2) return <div className={`sparkline emptySpark ${large ? 'large' : ''}`}>Intraday chart unavailable</div>;
  const width = large ? 360 : 130;
  const height = large ? 72 : 34;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  return <svg className={`sparkline ${large ? 'large' : ''} ${positive ? 'positive' : 'negative'}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

function NewsPanel({ items, active, setActive, status }) {
  return <section className="panel newsPanel">
    <PanelHead title="News" subtitle={status} action={<div className="segmented small"><button className={active === 'Top' ? 'active' : ''} onClick={() => setActive('Top')}>Top</button><button className={active === 'Markets' ? 'active' : ''} onClick={() => setActive('Markets')}>Markets</button></div>} />
    <div className="newsList">
      {items.length === 0 && <div className="emptyCompact">Headlines are temporarily unavailable.</div>}
      {items.map(n => <a href={n.link} target="_blank" rel="noreferrer" key={n.id}><div><strong>{n.title}</strong><small>{n.source || 'News'} · {n.published ? new Date(n.published).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</small></div><span>↗</span></a>)}
    </div>
  </section>;
}

function TodoPanel({ todos, setTodos, newTodo, setNewTodo, addTodo }) {
  const open = todos.filter(t => !t.done);
  return <section className="panel compactUtility">
    <PanelHead title="To‑Do" subtitle={`${open.length} open task${open.length === 1 ? '' : 's'}`} />
    <form className="todoForm" onSubmit={addTodo}><input value={newTodo} onChange={e => setNewTodo(e.target.value)} placeholder="Add a personal task…" /><button>Add</button></form>
    <div className="todoList compact">
      {todos.slice(0, 6).map(t => <div className={`todo ${t.done ? 'done' : ''}`} key={t.id}><button className="circleCheck" onClick={() => setTodos(xs => xs.map(x => x.id === t.id ? { ...x, done: !x.done } : x))}>{t.done ? '✓' : '○'}</button><span>{t.text}</span><button className="deleteButton" onClick={() => setTodos(xs => xs.filter(x => x.id !== t.id))}>×</button></div>)}
      {todos.length === 0 && <div className="emptyCompact">No personal tasks.</div>}
    </div>
  </section>;
}

function PlannerPanel({ plan, studyProgress, estimateOverrides, setEstimateOverrides, manualStudy }) {
  return <section className="panel compactUtility">
    <PanelHead title="Study Planner" subtitle="Upcoming workload and placement" />
    <div className="plannerRows">
      {plan.targets.slice(0, 6).map(t => {
        const total = Number(estimateOverrides[t.id] ?? t.estimateHours) * 60;
        const done = Number(studyProgress[t.id] || 0);
        const manual = manualStudy.filter(s => s.targetId === t.id && !s.completed).reduce((sum, s) => sum + (new Date(s.endAt) - new Date(s.startAt)) / MIN, 0);
        const auto = plan.sessions.filter(s => s.targetId === t.id).reduce((sum, s) => sum + s.minutes, 0);
        return <div className="plannerRow" key={t.id}><div><span className="courseTag" style={{ '--tag': COURSES[t.course].color }}>{COURSES[t.course].code}</span><strong>{t.title}</strong><small>{formatDuration(done)} done · {formatDuration(auto + manual)} scheduled{t.unscheduledMinutes ? ` · ${formatDuration(t.unscheduledMinutes)} unplaced` : ''}</small></div><label><input type="number" min="0.5" max="30" step="0.5" value={estimateOverrides[t.id] ?? t.estimateHours} onChange={e => setEstimateOverrides(v => ({ ...v, [t.id]: e.target.value }))} /><span>h</span></label><div className="miniBar"><span style={{ width: `${percentDone(done, total)}%` }} /></div></div>;
      })}
    </div>
  </section>;
}

function EventDetail({ event, completedSessions, onClose, onDelete, onAutoComplete, onManualComplete, onLockAuto, onToggleManualLock, onReturnToAuto, onEditCustom }) {
  const academic = event.targetId ? findAcademic(event.targetId) : event.academicId ? findAcademic(event.academicId) : null;
  const duration = Math.round((new Date(event.endAt) - new Date(event.startAt)) / MIN);
  return <Modal onClose={onClose}>
    <div className="detailHeader"><span className="kicker">{event.auto ? 'AUTO-PLANNED' : event.manualPositioned ? 'MANUALLY POSITIONED' : event.locked ? 'LOCKED' : String(event.kind || 'EVENT').toUpperCase()}</span><h2>{event.title.replace(/^Study:\s*/, '')}</h2><p>{fmtDate(event.startAt)} · {fmtTime(event.startAt)}–{fmtTime(event.endAt)} · {formatDuration(duration)}</p></div>
    <div className="detailFacts">
      {event.course && <div><span>Course</span><strong>{COURSES[event.course]?.code}</strong></div>}
      {academic?.weight && <div><span>Grade weight</span><strong>{academic.weight}%</strong></div>}
      {academic?.due && <div><span>Deadline</span><strong>{fmtDate(academic.due)}</strong></div>}
      {academic && <div><span>Study estimate</span><strong>{formatDuration((academic.estimateHours || 0) * 60)}</strong></div>}
    </div>
    {event.auto && academic && <div className="explainBox"><strong>Why this is here</strong><span>Auto-planned for {academic.title}. Deadline {fmtDate(academic.due)}{academic.weight ? ` · ${academic.weight}% of the course grade` : ''}.</span></div>}
    {event.location && <p className="detailNote">Location: {event.location}</p>}
    {academic?.note && <p className="detailNote">{academic.note}</p>}
    <div className="modalActions">
      {event.source === 'planner' && <><button className="primaryButton" onClick={() => onAutoComplete(event)}>{completedSessions[event.id] ? 'Undo complete' : 'Mark complete'}</button><button className="quietButton" onClick={() => onLockAuto(event)}>Lock here</button><button className="dangerButton" onClick={() => onDelete(event)}>Delete block</button></>}
      {event.source === 'manual-study' && <><button className="primaryButton" onClick={() => onManualComplete(event)}>{event.completed ? 'Undo complete' : 'Mark complete'}</button><button className="quietButton" onClick={() => onToggleManualLock(event)}>{event.locked ? 'Unlock' : 'Lock'}</button><button className="quietButton" onClick={() => onReturnToAuto(event)}>Return to auto</button><button className="dangerButton" onClick={() => onDelete(event)}>Delete</button></>}
      {event.source === 'custom' && <><button className="primaryButton" onClick={() => onEditCustom(event)}>Edit</button><button className="dangerButton" onClick={() => onDelete(event)}>Delete</button></>}
      {!['planner', 'manual-study', 'custom'].includes(event.source) && <button className="quietButton" onClick={onClose}>Close</button>}
    </div>
  </Modal>;
}

function EventEditor({ draft, setDraft, onSave, onClose }) {
  const weekdays = [['S', 0], ['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6]];
  return <Modal onClose={onClose}>
    <div className="detailHeader"><span className="kicker">{draft.id ? 'EDIT EVENT' : 'NEW EVENT'}</span><h2>{draft.id ? draft.title : 'Add calendar block'}</h2></div>
    <div className="formGrid">
      <label className="full"><span>Title</span><input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Gym, appointment, errand…" /></label>
      <label><span>Date</span><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label><span>Category</span><select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}><option value="personal">Personal</option><option value="workout">Workout</option><option value="appointment">Appointment</option><option value="errand">Errand</option><option value="other">Other</option></select></label>
      <label><span>Start</span><input type="time" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
      <label><span>End</span><input type="time" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
      <label><span>Repeat</span><select value={draft.recurrence?.freq || 'none'} onChange={e => setDraft({ ...draft, recurrence: { ...draft.recurrence, freq: e.target.value } })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="custom">Custom weekdays</option></select></label>
      <label className="lockToggle"><span>Scheduling</span><button type="button" className={draft.locked ? 'active' : ''} onClick={() => setDraft({ ...draft, locked: !draft.locked })}>{draft.locked ? 'Locked' : 'Flexible'}</button></label>
      {draft.recurrence?.freq === 'custom' && <div className="weekdayPicker full"><span>Repeat on</span><div>{weekdays.map(([label, value]) => { const active = (draft.recurrence.weekdays || []).includes(value); return <button type="button" className={active ? 'active' : ''} key={`${label}-${value}`} onClick={() => setDraft({ ...draft, recurrence: { ...draft.recurrence, weekdays: active ? draft.recurrence.weekdays.filter(x => x !== value) : [...(draft.recurrence.weekdays || []), value] } })}>{label}</button>; })}</div></div>}
    </div>
    <div className="modalActions"><button className="primaryButton" onClick={() => onSave(draft)}>Save event</button><button className="quietButton" onClick={onClose}>Cancel</button></div>
  </Modal>;
}

function PlannerSettings({ prefs, setPrefs, onClose }) {
  const [draft, setDraft] = useState(prefs);
  return <Modal onClose={onClose}>
    <div className="detailHeader"><span className="kicker">SMART STUDY PLANNER</span><h2>Scheduling preferences</h2><p>These guide automatic placement. Your locked and manually positioned blocks still take priority.</p></div>
    <div className="formGrid">
      <label><span>Preferred time</span><select value={draft.preferredTime} onChange={e => setDraft({ ...draft, preferredTime: e.target.value })}><option value="balanced">Balanced</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label>
      <label><span>Max session</span><select value={draft.maxSessionMinutes} onChange={e => setDraft({ ...draft, maxSessionMinutes: Number(e.target.value) })}><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label>
      <label><span>Earliest study</span><input type="time" value={draft.earliest} onChange={e => setDraft({ ...draft, earliest: e.target.value })} /></label>
      <label><span>Latest study</span><input type="time" value={draft.latest} onChange={e => setDraft({ ...draft, latest: e.target.value })} /></label>
      <label><span>Minimum break</span><select value={draft.minBreakMinutes} onChange={e => setDraft({ ...draft, minBreakMinutes: Number(e.target.value) })}><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label>
      <label className="lockToggle"><span>Weekends</span><button type="button" className={draft.lightWeekends ? 'active' : ''} onClick={() => setDraft({ ...draft, lightWeekends: !draft.lightWeekends })}>{draft.lightWeekends ? 'Lighter' : 'Normal'}</button></label>
    </div>
    <details className="advancedPrefs"><summary>Advanced</summary><div className="formGrid"><label><span>Weekday study cap</span><input type="number" min="60" max="600" step="15" value={draft.weekdayCapMinutes} onChange={e => setDraft({ ...draft, weekdayCapMinutes: Number(e.target.value) })} /></label><label><span>Weekend study cap</span><input type="number" min="60" max="600" step="15" value={draft.weekendCapMinutes} onChange={e => setDraft({ ...draft, weekendCapMinutes: Number(e.target.value) })} /></label><label><span>Calendar buffer</span><input type="number" min="0" max="60" step="5" value={draft.bufferMinutes} onChange={e => setDraft({ ...draft, bufferMinutes: Number(e.target.value) })} /></label></div></details>
    <div className="modalActions"><button className="primaryButton" onClick={() => { setPrefs(draft); onClose(); }}>Save preferences</button><button className="quietButton" onClick={onClose}>Cancel</button></div>
  </Modal>;
}

function PanelHead({ title, subtitle, action }) {
  return <div className="panelHead"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function Modal({ children, onClose }) {
  return <div className="modalBackdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal"><button className="modalClose" onClick={onClose}>×</button>{children}</div></div>;
}
