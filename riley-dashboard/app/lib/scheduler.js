import { ACADEMIC_EVENTS, NO_CLASS_DATES, RECURRING } from '../data';

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const minutes = hhmm => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h === 24 ? 24 * 60 : h * 60 + m;
};
export const fromMinutes = (date, mins) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60);
export const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtDate = d => new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtLong = d => new Date(d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
export const round15 = value => Math.round(value / 15) * 15;

export function formatDuration(totalMinutes, compact = false) {
  const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (compact && mins >= 60) return `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)}h`;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function urgency(event, now) {
  if (!event?.due) return 'tbd';
  const diff = new Date(event.due) - now;
  if (diff < 0) return 'past';
  if (diff <= DAY) return 'today';
  if (diff <= 3 * DAY) return 'urgent';
  if (diff <= 7 * DAY) return 'week';
  return 'later';
}

export function countdown(due, now = new Date()) {
  const diff = new Date(due) - now;
  if (diff <= 0) return 'due now';
  const days = Math.floor(diff / DAY);
  if (days >= 2) return `${days} days`;
  if (days === 1) return '1 day';
  const hrs = Math.floor(diff / HOUR);
  if (hrs >= 1) return `${hrs}h`;
  return `${Math.max(1, Math.floor(diff / MIN))}m`;
}

export function fixedForDate(date) {
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
      fixed: true,
      locked: true,
      source: 'recurring'
    });
  }
  for (const e of ACADEMIC_EVENTS) {
    if (!e.due || isoDate(new Date(e.due)) !== key) continue;
    if (!['midterm', 'quiz', 'assignment', 'final'].includes(e.type) || !e.end) continue;
    items.push({
      id: `assessment-${e.id}`,
      academicId: e.id,
      title: e.title,
      course: e.course,
      kind: 'assessment',
      startAt: new Date(e.due),
      endAt: new Date(e.end),
      location: e.location,
      weight: e.weight,
      fixed: true,
      locked: true,
      source: 'academic'
    });
  }
  const assessments = items.filter(x => x.kind === 'assessment');
  return items
    .filter(x => !(x.kind === 'class' && assessments.some(a => a.course === x.course && a.startAt < x.endAt && a.endAt > x.startAt)))
    .sort((a, b) => a.startAt - b.startAt);
}

function recurrenceMatches(event, date) {
  const startDate = new Date(`${event.date}T00:00:00`);
  const current = dayStart(date);
  if (current < dayStart(startDate)) return false;
  const rec = event.recurrence || { freq: 'none' };
  if (rec.freq === 'none') return isoDate(current) === event.date;
  if (rec.freq === 'daily') return true;
  if (rec.freq === 'weekly') return current.getDay() === startDate.getDay();
  if (rec.freq === 'custom') return (rec.weekdays || []).includes(current.getDay());
  return false;
}

export function expandCustomEvents(customEvents, start, end) {
  const out = [];
  for (let d = dayStart(start); d < end; d = addDays(d, 1)) {
    for (const event of customEvents) {
      if (!recurrenceMatches(event, d)) continue;
      const startAt = fromMinutes(d, minutes(event.start));
      const endAt = fromMinutes(d, minutes(event.end));
      out.push({
        ...event,
        instanceId: `${event.id}-${isoDate(d)}`,
        startAt,
        endAt,
        source: 'custom',
        fixed: false
      });
    }
  }
  return out;
}

export function academicDeadlinesForRange(start, end) {
  return ACADEMIC_EVENTS.filter(e => e.due && !e.end && new Date(e.due) >= start && new Date(e.due) < end)
    .map(e => {
      const due = new Date(e.due);
      return {
        id: `deadline-${e.id}`,
        academicId: e.id,
        title: e.title,
        course: e.course,
        kind: 'deadline',
        startAt: due,
        endAt: new Date(due.getTime() + 30 * MIN),
        weight: e.weight,
        source: 'academic',
        locked: true,
        fixed: true,
        due: e.due
      };
    });
}

function mergeBusy(items, date, prefs) {
  const buffer = Math.max(0, Number(prefs.bufferMinutes ?? 15));
  const earliest = minutes(prefs.earliest || '08:00');
  const latest = minutes(prefs.latest || '22:00');
  const ranges = items.map(x => ({
    start: Math.max(earliest, Math.round((new Date(x.startAt) - dayStart(date)) / MIN) - buffer),
    end: Math.min(latest, Math.round((new Date(x.endAt) - dayStart(date)) / MIN) + buffer)
  })).filter(x => x.end > earliest && x.start < latest).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    if (!merged.length || r.start > merged.at(-1).end) merged.push({ ...r });
    else merged.at(-1).end = Math.max(merged.at(-1).end, r.end);
  }
  return merged;
}

function preferenceScore(window, preferredTime) {
  const midpoint = (window.start + window.end) / 2;
  if (preferredTime === 'morning') return Math.abs(midpoint - 10 * 60);
  if (preferredTime === 'afternoon') return Math.abs(midpoint - 14 * 60);
  if (preferredTime === 'evening') return Math.abs(midpoint - 18.5 * 60);
  return window.start;
}

function freeWindows(date, busyItems, dailyScheduledMinutes, prefs) {
  const earliest = minutes(prefs.earliest || '08:00');
  const latest = minutes(prefs.latest || '22:00');
  const busy = mergeBusy(busyItems, date, prefs);
  const windows = [];
  let cursor = earliest;
  for (const b of busy) {
    if (b.start - cursor >= 30) windows.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (latest - cursor >= 30) windows.push({ start: cursor, end: latest });

  const weekdayCap = Number(prefs.weekdayCapMinutes || 210);
  const weekendBase = Number(prefs.weekendCapMinutes || 300);
  const weekendFactor = prefs.lightWeekends ? 0.7 : 1;
  const cap = [0, 6].includes(date.getDay()) ? weekendBase * weekendFactor : weekdayCap;
  let left = Math.max(0, cap - dailyScheduledMinutes);

  return windows
    .sort((a, b) => preferenceScore(a, prefs.preferredTime) - preferenceScore(b, prefs.preferredTime))
    .flatMap(w => {
      if (left < 30) return [];
      const len = Math.min(w.end - w.start, left);
      left -= len;
      return [{ start: w.start, end: w.start + len }];
    });
}

export function buildStudyPlan({ now, completedEvents, estimateOverrides, studyProgress, customEvents, manualStudy, blackouts, prefs }) {
  const start = dayStart(now);
  const horizon = addDays(start, 14);
  const allCustom = expandCustomEvents(customEvents, start, addDays(horizon, 1));
  const targets = ACADEMIC_EVENTS
    .filter(e => e.due && new Date(e.due) > now && new Date(e.due) <= horizon && e.estimateHours > 0 && !completedEvents[e.id])
    .map(e => ({ ...e, hoursNeeded: Number(estimateOverrides[e.id] ?? e.estimateHours) }))
    .sort((a, b) => new Date(a.due) - new Date(b.due) || (b.weight || 0) - (a.weight || 0));

  const sessions = [];
  const daily = {};
  const minBreak = Math.max(0, Number(prefs.minBreakMinutes ?? 15));
  const maxSession = Math.max(45, Math.min(180, Number(prefs.maxSessionMinutes || 90)));

  for (const target of targets) {
    const deadline = new Date(target.due);
    const cutoff = deadline.getHours() < 15 ? addDays(dayStart(deadline), -1) : dayStart(deadline);
    const completedMinutes = Number(studyProgress[target.id] || 0);
    const manualForTarget = manualStudy.filter(s => s.targetId === target.id && !s.completed && new Date(s.endAt) > now && new Date(s.startAt) < deadline);
    const manualMinutes = manualForTarget.reduce((sum, s) => sum + Math.round((new Date(s.endAt) - new Date(s.startAt)) / MIN), 0);
    let remaining = Math.max(0, Math.round(target.hoursNeeded * 60) - completedMinutes - manualMinutes);

    const days = [];
    for (let d = start; d <= cutoff; d = addDays(d, 1)) days.push(new Date(d));
    const orderedDays = days.sort((a, b) => {
      const aLoad = daily[isoDate(a)] || 0;
      const bLoad = daily[isoDate(b)] || 0;
      return aLoad - bLoad || a - b;
    });

    for (const date of orderedDays) {
      if (remaining <= 0) break;
      const key = isoDate(date);
      const fixed = fixedForDate(date);
      const dayCustom = allCustom.filter(x => isoDate(x.startAt) === key);
      const dayManual = manualStudy.filter(x => isoDate(new Date(x.startAt)) === key).map(x => ({ ...x, startAt: new Date(x.startAt), endAt: new Date(x.endAt) }));
      const dayBlackouts = blackouts.filter(x => isoDate(new Date(x.startAt)) === key).map(x => ({ ...x, startAt: new Date(x.startAt), endAt: new Date(x.endAt) }));
      const earlierAuto = sessions.filter(s => isoDate(s.startAt) === key);
      const elapsedToday = isoDate(date) === isoDate(now) ? [{ id: 'elapsed-today', startAt: dayStart(date), endAt: new Date(now.getTime() + 15 * MIN) }] : [];
      const busy = [...fixed, ...dayCustom, ...dayManual, ...dayBlackouts, ...earlierAuto, ...elapsedToday];
      const windows = freeWindows(date, busy, daily[key] || 0, prefs);
      for (const w of windows) {
        if (remaining <= 0) break;
        let cursor = w.start;
        while (cursor + 30 <= w.end && remaining > 0) {
          let duration = Math.min(maxSession, remaining, w.end - cursor);
          if (remaining > duration && remaining - duration < 30 && duration - (30 - (remaining - duration)) >= 30) {
            duration -= 30 - (remaining - duration);
          }
          if (duration < 30) break;
          const startAt = fromMinutes(date, cursor);
          const endAt = fromMinutes(date, cursor + duration);
          const id = `study-${target.id}-${isoDate(date)}-${pad(Math.floor(cursor / 60))}${pad(cursor % 60)}-${duration}`;
          sessions.push({
            id,
            targetId: target.id,
            course: target.course,
            kind: 'study',
            title: `Study: ${target.title}`,
            startAt,
            endAt,
            minutes: duration,
            deadline,
            weight: target.weight,
            auto: true,
            locked: false,
            manualPositioned: false,
            source: 'planner'
          });
          daily[key] = (daily[key] || 0) + duration;
          remaining -= duration;
          cursor += duration + minBreak;
        }
      }
    }
    target.unscheduledMinutes = Math.max(0, remaining);
    target.completedMinutes = completedMinutes;
    target.manualScheduledMinutes = manualMinutes;
  }

  return { targets, sessions: sessions.sort((a, b) => a.startAt - b.startAt) };
}

export function conflictsForManualStudies(manualStudy, customEvents, rangeStart, rangeEnd) {
  const custom = expandCustomEvents(customEvents, rangeStart, rangeEnd);
  const conflicts = [];
  for (const study of manualStudy) {
    const startAt = new Date(study.startAt);
    const endAt = new Date(study.endAt);
    if (endAt <= rangeStart || startAt >= rangeEnd) continue;
    const hard = [...fixedForDate(startAt), ...custom.filter(x => x.locked && isoDate(x.startAt) === isoDate(startAt))];
    for (const item of hard) {
      if (startAt < item.endAt && endAt > item.startAt) {
        conflicts.push({ studyId: study.id, withId: item.id, withTitle: item.title });
      }
    }
  }
  return conflicts;
}

export function freePeriodsForDay(date, events, startMinute = 8 * 60, endMinute = 22 * 60) {
  const ranges = events
    .map(e => ({ start: Math.max(startMinute, Math.round((new Date(e.startAt) - dayStart(date)) / MIN)), end: Math.min(endMinute, Math.round((new Date(e.endAt) - dayStart(date)) / MIN)) }))
    .filter(r => r.end > startMinute && r.start < endMinute)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    if (!merged.length || r.start > merged.at(-1).end) merged.push({ ...r });
    else merged.at(-1).end = Math.max(merged.at(-1).end, r.end);
  }
  const out = [];
  let cursor = startMinute;
  for (const r of merged) {
    if (r.start - cursor >= 45) out.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (endMinute - cursor >= 45) out.push({ start: cursor, end: endMinute });
  return out;
}
