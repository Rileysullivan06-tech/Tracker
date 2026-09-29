# Riley Dashboard V2

A personal school/work/life + markets/news command center for Fall 2026.

## V2 redesign

- Compact opening dashboard focused on Today, Upcoming, Markets, and News.
- Real time-grid calendar with Day / Week / Month views.
- Native drag-and-drop for flexible calendar blocks and planner-generated study sessions.
- Resizable flexible blocks.
- Manual custom events with recurrence and lock/flexible state.
- Distinction between locked constraints, manually positioned study blocks, and automatic study blocks.
- Smart Study Planner preserved and extended with scheduling preferences.
- Deleting/shortening an automatic study session returns missing time to the planner instead of reducing the required workload.
- Explicit Replan action plus visible unplaced-work/conflict status.
- Upcoming assessments show course weight, countdown, study progress, scheduled time, and unplaced time where available.
- Configurable pinned market widgets.
- Intraday sparklines use the existing Yahoo Finance data source when intraday data is available; the UI shows an unavailable state rather than inventing chart data.
- Compact news list using the existing Google News RSS integration.
- Existing browser-local persistence retained and extended.

## Data and persistence

Existing keys are preserved:

- `riley.completedEvents`
- `riley.completedSessions`
- `riley.estimateOverrides`
- `riley.studyProgress`
- `riley.todos`

V2 adds:

- `riley.customEvents`
- `riley.manualStudy`
- `riley.studyBlackouts`
- `riley.plannerPrefs`
- `riley.pinnedSymbols`

All persistence remains browser-local. No account, backend database, or cross-device sync was added.

## Market/news integrations

No API keys are required.

- Quotes + intraday chart points: Yahoo Finance chart endpoint through `/api/quotes`.
- News: Google News RSS through `/api/news`.

These are third-party public endpoints and can throttle or change. The dashboard degrades gracefully when data is unavailable.

## Run locally

1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Deploy to Vercel

The project remains a standard Next.js app. Push this folder to the GitHub repo connected to Vercel. Vercel should use the Next.js framework preset and the repository root should point to this `riley-dashboard` folder if it remains nested in the repo.

## Academic-data note

Existing Fall 2026 academic data was retained. Unknown source dates remain unknown rather than being invented, including registrar-set final exam dates and D2L-only dates.
