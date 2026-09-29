'use client';

import { useMemo, useRef } from 'react';
import { COURSES } from '../data';
import { addDays, dayStart, fmtDate, fmtTime, fromMinutes, isoDate, MIN, round15 } from '../lib/scheduler';

const CAL_START = 7 * 60;
const CAL_END = 24 * 60;
const HOUR_HEIGHT = 50;
const PX_PER_MIN = HOUR_HEIGHT / 60;

function mondayOf(date) {
  return addDays(dayStart(date), -((date.getDay() + 6) % 7));
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function eventColor(event) {
  if (event.course && COURSES[event.course]) return COURSES[event.course].color;
  if (event.kind === 'work') return '#f06464';
  if (event.kind === 'personal') return '#66a6ff';
  if (event.kind === 'workout') return '#4ec9a4';
  if (event.kind === 'appointment') return '#d18cff';
  if (event.kind === 'deadline') return '#ffb45f';
  return '#7f93a7';
}

function canDrag(event) {
  if (event.locked) return false;
  if (event.source === 'custom' && event.recurrence?.freq && event.recurrence.freq !== 'none') return false;
  return ['custom', 'manual-study', 'planner'].includes(event.source);
}

function canResize(event) {
  return canDrag(event) && event.kind !== 'deadline';
}

export default function SmartCalendar({
  view,
  setView,
  anchorDate,
  setAnchorDate,
  events,
  onSelectEvent,
  onMoveEvent,
  onResizeEvent,
  onCreateAt,
  onOpenPreferences,
  onReplan,
  plannerStatus
}) {
  const range = useMemo(() => {
    if (view === 'day') return { start: dayStart(anchorDate), end: addDays(dayStart(anchorDate), 1) };
    if (view === 'month') {
      const first = monthStart(anchorDate);
      const gridStart = addDays(first, -((first.getDay() + 6) % 7));
      return { start: gridStart, end: addDays(gridStart, 42) };
    }
    const start = mondayOf(anchorDate);
    return { start, end: addDays(start, 7) };
  }, [view, anchorDate]);

  const visibleEvents = useMemo(() => events.filter(e => new Date(e.endAt) > range.start && new Date(e.startAt) < range.end), [events, range]);

  function move(direction) {
    if (view === 'day') setAnchorDate(addDays(anchorDate, direction));
    else if (view === 'week') setAnchorDate(addDays(anchorDate, direction * 7));
    else setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1));
  }

  const title = view === 'day'
    ? anchorDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : view === 'week'
      ? `${range.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(range.end, -1).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      : anchorDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return <section className="calendarPanel">
    <div className="calendarToolbar">
      <div className="calendarNav">
        <button className="iconButton" onClick={() => move(-1)} aria-label="Previous">‹</button>
        <button className="quietButton" onClick={() => setAnchorDate(new Date())}>Today</button>
        <button className="iconButton" onClick={() => move(1)} aria-label="Next">›</button>
        <div className="calendarTitle">{title}</div>
      </div>
      <div className="calendarActions">
        <span className={`plannerState ${plannerStatus?.warn ? 'warn' : ''}`}>{plannerStatus?.text}</span>
        <button className="quietButton" onClick={onOpenPreferences}>Planner settings</button>
        <button className="quietButton" onClick={onReplan}>Replan</button>
        <button className="primaryButton" onClick={() => onCreateAt(anchorDate, 12 * 60)}>+ Event</button>
        <div className="segmented">
          {['day', 'week', 'month'].map(v => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>
    </div>

    {view === 'month'
      ? <MonthGrid start={range.start} events={visibleEvents} anchorDate={anchorDate} setAnchorDate={setAnchorDate} setView={setView} onSelectEvent={onSelectEvent} />
      : <TimeGrid days={view === 'day' ? [range.start] : Array.from({ length: 7 }, (_, i) => addDays(range.start, i))} events={visibleEvents} onSelectEvent={onSelectEvent} onMoveEvent={onMoveEvent} onResizeEvent={onResizeEvent} onCreateAt={onCreateAt} />}
  </section>;
}

function TimeGrid({ days, events, onSelectEvent, onMoveEvent, onResizeEvent, onCreateAt }) {
  const hours = Array.from({ length: (CAL_END - CAL_START) / 60 + 1 }, (_, i) => CAL_START / 60 + i);
  return <div className="timeGridWrap">
    <div className="timeGrid" style={{ '--day-count': days.length }}>
      <div className="timeHeaderSpacer" />
      {days.map(d => <div className={`timeDayHeader ${isoDate(d) === isoDate(new Date()) ? 'isToday' : ''}`} key={isoDate(d)}>
        <span>{d.toLocaleDateString([], { weekday: 'short' })}</span><b>{d.getDate()}</b>
      </div>)}
      <div className="timeAxis" style={{ height: (CAL_END - CAL_START) * PX_PER_MIN }}>
        {hours.slice(0, -1).map(h => <span key={h} style={{ top: (h * 60 - CAL_START) * PX_PER_MIN }}>{new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}</span>)}
      </div>
      {days.map(date => <DayLane key={isoDate(date)} date={date} events={events.filter(e => isoDate(new Date(e.startAt)) === isoDate(date))} onSelectEvent={onSelectEvent} onMoveEvent={onMoveEvent} onResizeEvent={onResizeEvent} onCreateAt={onCreateAt} />)}
    </div>
  </div>;
}

function DayLane({ date, events, onSelectEvent, onMoveEvent, onResizeEvent, onCreateAt }) {
  const laneRef = useRef(null);
  const height = (CAL_END - CAL_START) * PX_PER_MIN;

  function minuteFromClientY(clientY) {
    const rect = laneRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return Math.max(CAL_START, Math.min(CAL_END - 15, round15(CAL_START + y / PX_PER_MIN)));
  }

  function handleDrop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/riley-event');
    const event = events.find(x => x.id === id) || JSON.parse(e.dataTransfer.getData('application/riley-event') || 'null');
    if (!event) return;
    const startMinute = minuteFromClientY(e.clientY);
    onMoveEvent(event, date, startMinute);
  }

  return <div
    className="dayLane"
    ref={laneRef}
    style={{ height }}
    onDragOver={e => e.preventDefault()}
    onDrop={handleDrop}
    onDoubleClick={e => onCreateAt(date, minuteFromClientY(e.clientY))}
  >
    {Array.from({ length: (CAL_END - CAL_START) / 60 }, (_, i) => <div className="hourLine" style={{ top: i * HOUR_HEIGHT }} key={i} />)}
    {events.map(event => <CalendarBlock key={event.instanceId || event.id} event={event} onSelectEvent={onSelectEvent} onResizeEvent={onResizeEvent} />)}
  </div>;
}

function CalendarBlock({ event, onSelectEvent, onResizeEvent }) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  const endMinute = end.getDate() !== start.getDate() ? 24 * 60 : end.getHours() * 60 + end.getMinutes();
  const top = Math.max(0, (startMinute - CAL_START) * PX_PER_MIN);
  const height = Math.max(24, (Math.min(CAL_END, endMinute) - Math.max(CAL_START, startMinute)) * PX_PER_MIN);
  const draggable = canDrag(event);
  const resizable = canResize(event);

  function beginResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const initialY = e.clientY;
    const initialMinutes = Math.max(15, Math.round((end - start) / MIN));
    function finish(ev) {
      const delta = round15((ev.clientY - initialY) / PX_PER_MIN);
      onResizeEvent(event, Math.max(30, initialMinutes + delta));
      window.removeEventListener('pointerup', finish);
    }
    window.addEventListener('pointerup', finish);
  }

  const cleanTitle = event.title?.replace(/^Study:\s*/, '');
  return <button
    className={`calendarEvent ${event.kind || ''} ${event.auto ? 'autoStudy' : ''} ${event.manualPositioned ? 'manualStudy' : ''}`}
    style={{ top, height, '--event-color': eventColor(event) }}
    onClick={e => { e.stopPropagation(); onSelectEvent(event); }}
    draggable={draggable}
    onDragStart={e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/riley-event', event.id);
      e.dataTransfer.setData('application/riley-event', JSON.stringify({ ...event, startAt: start.toISOString(), endAt: end.toISOString() }));
    }}
  >
    <span className="calendarEventTime">{fmtTime(start)}</span>
    <strong>{cleanTitle}</strong>
    <span className="calendarEventMeta">{event.auto ? 'AUTO' : event.manualPositioned ? 'MANUAL' : event.weight ? `${event.weight}%` : event.kind}{event.locked ? ' · LOCKED' : ''}</span>
    {resizable && <span className="resizeHandle" onPointerDown={beginResize} />}
  </button>;
}

function MonthGrid({ start, events, anchorDate, setAnchorDate, setView, onSelectEvent }) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return <div className="monthGrid">
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div className="monthDow" key={d}>{d}</div>)}
    {days.map(date => {
      const key = isoDate(date);
      const items = events.filter(e => isoDate(new Date(e.startAt)) === key && !['planner', 'manual-study'].includes(e.source))
        .sort((a, b) => priority(a) - priority(b) || new Date(a.startAt) - new Date(b.startAt));
      const inMonth = date.getMonth() === anchorDate.getMonth();
      return <div className={`monthCell ${!inMonth ? 'outside' : ''} ${key === isoDate(new Date()) ? 'isToday' : ''}`} key={key} onDoubleClick={() => { setAnchorDate(date); setView('day'); }}>
        <button className="monthDate" onClick={() => { setAnchorDate(date); setView('day'); }}>{date.getDate()}</button>
        <div className="monthItems">
          {items.slice(0, 4).map(e => <button key={e.instanceId || e.id} className={`monthEvent ${e.kind}`} style={{ '--event-color': eventColor(e) }} onClick={() => onSelectEvent(e)}><span />{e.title.replace(/^Study:\s*/, '')}{e.weight ? ` · ${e.weight}%` : ''}</button>)}
          {items.length > 4 && <span className="moreEvents">+{items.length - 4} more</span>}
        </div>
      </div>;
    })}
  </div>;
}

function priority(event) {
  if (event.kind === 'deadline' || event.kind === 'assessment') return 0;
  if (event.kind === 'work' || event.kind === 'class') return 1;
  if (event.source === 'custom') return 2;
  return 3;
}
