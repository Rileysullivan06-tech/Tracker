export const COURSES = {
  gned: { code: 'GNED 1202', name: 'Texts & Ideas', color: '#8b5cf6' },
  law: { code: 'MGMT 3230', name: 'Business Law', color: '#f59e0b' },
  acct: { code: 'ACCT 3224', name: 'Management Accounting I', color: '#22c55e' },
  fnce: { code: 'FNCE 3227', name: 'Introduction to Finance', color: '#3b82f6' }
};

// Recurring academic and work commitments. Classes automatically skip university closure dates.
export const RECURRING = [
  { id: 'gned-mon', kind: 'class', course: 'gned', weekday: 1, start: '11:30', end: '12:50', title: 'GNED 1202', location: 'T131' },
  { id: 'gned-wed', kind: 'class', course: 'gned', weekday: 3, start: '11:30', end: '12:50', title: 'GNED 1202', location: 'T131' },
  { id: 'law-mon', kind: 'class', course: 'law', weekday: 1, start: '13:00', end: '14:20', title: 'Business Law', location: 'EB1102' },
  { id: 'law-wed', kind: 'class', course: 'law', weekday: 3, start: '13:00', end: '14:20', title: 'Business Law', location: 'EB1102' },
  { id: 'acct-tue', kind: 'class', course: 'acct', weekday: 2, start: '10:00', end: '11:20', title: 'ACCT 3224', location: 'EB2138' },
  { id: 'acct-thu', kind: 'class', course: 'acct', weekday: 4, start: '10:00', end: '11:20', title: 'ACCT 3224', location: 'EB2138' },
  { id: 'fnce-tue', kind: 'class', course: 'fnce', weekday: 2, start: '13:00', end: '14:20', title: 'FNCE 3227', location: 'EB3112' },
  { id: 'fnce-thu', kind: 'class', course: 'fnce', weekday: 4, start: '13:00', end: '14:20', title: 'FNCE 3227', location: 'EB3112' },
  { id: 'work-tue', kind: 'work', weekday: 2, start: '17:00', end: '21:15', title: 'Work' },
  { id: 'work-wed', kind: 'work', weekday: 3, start: '16:00', end: '24:00', title: 'Work' },
  { id: 'work-thu', kind: 'work', weekday: 4, start: '16:45', end: '24:00', title: 'Work' }
];

export const NO_CLASS_DATES = new Set([
  '2026-09-07',
  '2026-09-30',
  '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
  '2026-11-11'
]);

// Source-audited Fall 2026 assessment/deadline data. Items whose exact registrar date is unknown stay TBD.
export const ACADEMIC_EVENTS = [
  // Business Law
  { id: 'law-q1', course: 'law', title: 'Quiz 1 — Legal Environment', type: 'quiz', due: '2026-09-16T23:59:00', weight: 3, chapters: 4, estimateHours: 2.0 },
  { id: 'law-q2', course: 'law', title: 'Quiz 2 — Business Torts', type: 'quiz', due: '2026-09-28T23:59:00', weight: 3, chapters: 3, estimateHours: 2.0 },
  { id: 'law-midterm', course: 'law', title: 'Business Law Midterm', type: 'midterm', due: '2026-10-07T13:00:00', end: '2026-10-07T14:20:00', weight: 20, chapters: 7, estimateHours: 9, location: 'EB1102', note: 'Closed book; Chapters 1–4 & 10–12; D2L + LockDown Browser; handwritten double-sided reference sheet allowed.' },
  { id: 'law-q3', course: 'law', title: 'Quiz 3 — Contracts', type: 'quiz', due: '2026-11-02T23:59:00', weight: 3, chapters: 5, estimateHours: 2.5 },
  { id: 'law-contract-release', course: 'law', title: 'Contract released for in-class exercise', type: 'release', due: '2026-11-16T13:00:00', estimateHours: 0 },
  { id: 'law-contract-exercise', course: 'law', title: 'In-Class Contract Exercise', type: 'assignment', due: '2026-11-23T13:00:00', end: '2026-11-23T14:20:00', weight: 10, estimateHours: 4.5, location: 'EB1102', note: 'Individual; D2L + LockDown Browser; one handwritten double-sided reference sheet allowed.' },
  { id: 'law-q4', course: 'law', title: 'Quiz 4 — Structuring Business Activity', type: 'quiz', due: '2026-11-25T23:59:00', weight: 3, chapters: 4, estimateHours: 2.0 },
  { id: 'law-case-release', course: 'law', title: 'Case released for in-class exercise', type: 'release', due: '2026-11-30T13:00:00', estimateHours: 0 },
  { id: 'law-case-exercise', course: 'law', title: 'In-Class Case Exercise', type: 'assignment', due: '2026-12-07T13:00:00', end: '2026-12-07T14:20:00', weight: 10, estimateHours: 4.5, location: 'EB1102', note: 'Individual; D2L + LockDown Browser.' },
  { id: 'law-q5', course: 'law', title: 'Quiz 5 — Property Law', type: 'quiz', due: '2026-12-09T23:59:00', weight: 3, chapters: 3, estimateHours: 2.0 },
  { id: 'law-final', course: 'law', title: 'Business Law Final — Registrar TBD', type: 'final', due: null, window: 'Dec 11–21', weight: 30, chapters: 19, estimateHours: 12, note: 'Exact date TBD. Outline schedule gives Dec 11–21. Cumulative, 120 min, in person, D2L + LockDown Browser.' },

  // GNED
  { id: 'gned-a1', course: 'gned', title: 'Assignment 1 (~1000 words)', type: 'assignment', due: '2026-10-07T23:00:00', weight: 10, estimateHours: 6.0, note: 'AI-generated written content is prohibited for this course.' },
  { id: 'gned-m1', course: 'gned', title: 'Midterm 1', type: 'midterm', due: '2026-10-21T11:30:00', end: '2026-10-21T12:50:00', weight: 10, estimateHours: 5.0, location: 'T131' },
  { id: 'gned-a2', course: 'gned', title: 'Assignment 2 (~1000 words)', type: 'assignment', due: '2026-11-16T23:00:00', weight: 10, estimateHours: 6.0, note: 'AI-generated written content is prohibited for this course.' },
  { id: 'gned-m2', course: 'gned', title: 'Midterm 2', type: 'midterm', due: '2026-11-23T11:30:00', end: '2026-11-23T12:50:00', weight: 10, estimateHours: 5.0, location: 'T131' },
  { id: 'gned-term', course: 'gned', title: 'Term Paper (~1500 words)', type: 'term-paper', due: '2026-12-09T23:00:00', weight: 20, estimateHours: 10.0, note: 'Thomas More’s Utopia; AI-generated written content is prohibited for this course.' },
  { id: 'gned-final', course: 'gned', title: 'GNED Final — Registrar TBD', type: 'final', due: null, window: 'Final exam period', weight: 30, estimateHours: 10.0, note: '2 hours; exact date TBD.' },

  // Accounting
  { id: 'acct-ai', course: 'acct', title: 'Gen AI Ethics and Usage', type: 'homework', due: '2026-09-30T23:59:00', estimateHours: 0.5 },
  { id: 'acct-c2-hw', course: 'acct', title: 'Chapter 2 Homework', type: 'homework', due: '2026-10-01T23:59:00', estimateHours: 1.5 },
  { id: 'acct-c5-sb', course: 'acct', title: 'Chapter 5 SmartBook', type: 'smartbook', due: '2026-10-04T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c5-hw', course: 'acct', title: 'Chapter 5 Homework', type: 'homework', due: '2026-10-04T23:59:00', estimateHours: 1.75 },
  { id: 'acct-m1', course: 'acct', title: 'Accounting Midterm I', type: 'midterm', due: '2026-10-08T10:00:00', end: '2026-10-08T11:15:00', weight: 15, chapters: 3, estimateHours: 7.0, location: 'EB2138', note: 'Chapters 1, 2 & 5; one handwritten double-sided reference sheet allowed.' },
  { id: 'acct-c3-sb', course: 'acct', title: 'Chapter 3 SmartBook', type: 'smartbook', due: '2026-10-20T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c3-hw', course: 'acct', title: 'Chapter 3 Homework', type: 'homework', due: '2026-10-25T23:59:00', estimateHours: 1.75 },
  { id: 'acct-c4-sb', course: 'acct', title: 'Chapter 4 SmartBook', type: 'smartbook', due: '2026-11-01T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c4-hw', course: 'acct', title: 'Chapter 4 Homework', type: 'homework', due: '2026-11-01T23:59:00', estimateHours: 1.75 },
  { id: 'acct-m2', course: 'acct', title: 'Accounting Midterm II', type: 'midterm', due: '2026-11-03T10:00:00', end: '2026-11-03T11:15:00', weight: 20, chapters: 2, estimateHours: 7.0, location: 'EB2138', note: 'Chapters 3 & 4.' },
  { id: 'acct-c8-sb', course: 'acct', title: 'Chapter 8 SmartBook', type: 'smartbook', due: '2026-11-08T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c8-hw', course: 'acct', title: 'Chapter 8 Homework', type: 'homework', due: '2026-11-08T23:59:00', estimateHours: 1.75 },
  { id: 'acct-c9-sb', course: 'acct', title: 'Chapter 9 SmartBook', type: 'smartbook', due: '2026-11-22T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c9-hw', course: 'acct', title: 'Chapter 9 Homework', type: 'homework', due: '2026-11-22T23:59:00', estimateHours: 1.75 },
  { id: 'acct-budget', course: 'acct', title: 'Budgeting Quiz', type: 'quiz', due: '2026-11-24T10:00:00', end: '2026-11-24T11:20:00', weight: 10, chapters: 1, estimateHours: 4.0, location: 'EB2138', note: 'Chapter 9.' },
  { id: 'acct-c11-sb', course: 'acct', title: 'Chapter 11 SmartBook', type: 'smartbook', due: '2026-12-09T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c11-hw', course: 'acct', title: 'Chapter 11 Homework', type: 'homework', due: '2026-12-09T23:59:00', estimateHours: 1.75 },
  { id: 'acct-c12-sb', course: 'acct', title: 'Chapter 12 SmartBook', type: 'smartbook', due: '2026-12-09T23:59:00', estimateHours: 0.75 },
  { id: 'acct-c12-hw', course: 'acct', title: 'Chapter 12 Homework', type: 'homework', due: '2026-12-09T23:59:00', estimateHours: 1.75 },
  { id: 'acct-final', course: 'acct', title: 'Accounting Final — Registrar TBD', type: 'final', due: null, window: 'Dec 11–22', weight: 40, estimateHours: 14, note: 'Cumulative, 3 hours; exact date TBD.' },

  // Finance
  { id: 'fnce-q1', course: 'fnce', title: 'Quiz 1', type: 'quiz', due: '2026-09-24T13:00:00', end: '2026-09-24T14:15:00', weight: 5, chapters: 5, estimateHours: 3.0 },
  { id: 'fnce-ratio', course: 'fnce', title: 'Financial Ratio Analysis Assignment', type: 'assignment', due: '2026-10-20T13:00:00', weight: 15, estimateHours: 6.0, note: 'Due during/beginning of class; no late/make-up submission.' },
  { id: 'fnce-q2', course: 'fnce', title: 'Quiz 2 — Chapters 6 & 7', type: 'quiz', due: '2026-10-24T23:55:00', weight: 5, chapters: 2, estimateHours: 2.5, note: 'Take-home MyLab; 2-hour timer once started.' },
  { id: 'fnce-midterm', course: 'fnce', title: 'Finance Midterm', type: 'midterm', due: '2026-10-29T13:00:00', end: '2026-10-29T14:20:00', weight: 30, chapters: 7, estimateHours: 10.0, location: 'EB3112', note: 'Chapters 1–7.' },
  { id: 'fnce-q3', course: 'fnce', title: 'Quiz 3', type: 'quiz', due: '2026-11-17T13:00:00', end: '2026-11-17T14:15:00', weight: 5, chapters: 4, estimateHours: 3.0 },
  { id: 'fnce-q4', course: 'fnce', title: 'Quiz 4', type: 'quiz', due: '2026-12-05T23:55:00', weight: 5, chapters: 5, estimateHours: 3.0, note: 'Take-home MyLab; 2-hour timer once started.' },
  { id: 'fnce-final', course: 'fnce', title: 'Finance Final — Registrar TBD', type: 'final', due: null, window: 'Dec 11–22', weight: 40, estimateHours: 14.0, note: '3 hours; exact date TBD.' }
];

export const WATCHLIST = [
  { label: 'CVE', symbol: 'CVE.TO', asset: 'stock', note: 'Cenovus — TSX' },
  { label: 'CVX', symbol: 'CVX', asset: 'stock' },
  { label: 'GOOG', symbol: 'GOOG', asset: 'stock' },
  { label: 'HMAX', symbol: 'HMAX.TO', asset: 'etf', note: 'TSX' },
  { label: 'NOW', symbol: 'NOW', asset: 'stock' },
  { label: 'XEQT', symbol: 'XEQT.TO', asset: 'etf', note: 'TSX' },
  { label: 'ASM', symbol: 'ASM.TO', asset: 'stock', note: 'Avino — TSX' },
  { label: 'CAT', symbol: 'CAT', asset: 'stock' },
  { label: 'CUPR', symbol: 'CUPR.CN', asset: 'stock', note: 'Super Copper — CSE' },
  { label: 'FTT', symbol: 'FTT.TO', asset: 'stock', note: 'Finning — TSX' },
  { label: 'INTC', symbol: 'INTC', asset: 'stock' },
  { label: 'NVDA', symbol: 'NVDA', asset: 'stock' },
  { label: 'VOO', symbol: 'VOO', asset: 'etf' },
  { label: 'BTC', symbol: 'BTC-USD', asset: 'crypto' },
  { label: 'XRP', symbol: 'XRP-USD', asset: 'crypto' }
];
