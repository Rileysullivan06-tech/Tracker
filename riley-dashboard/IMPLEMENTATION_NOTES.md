# V2 implementation notes

## Existing implementation audit

The original app was a small Next.js 15 / React 19 project with no UI or calendar dependencies. Most application logic lived in `app/page.js`. Academic/work/watchlist data lived in `app/data.js`. The planner generated 14 days of study sessions in memory. Browser localStorage stored completed items, study progress, estimate overrides, and To-Do data. Quotes came from Yahoo Finance and news from Google News RSS through Next.js route handlers.

The redesign deliberately keeps that architecture lightweight instead of introducing a database, authentication layer, calendar framework, drag/drop framework, or new market-data provider.

## Technical decisions

### Calendar

A custom time-grid calendar was implemented with native browser drag/drop and pointer resizing instead of adding a calendar dependency. This avoids a new package and keeps the current project deployable with the same dependency set.

Day, Week, and Month views share the same event state. Recurring custom events are expanded at render/planning time.

### Scheduling state

The planner now distinguishes:

- recurring/fixed locked commitments,
- custom user events,
- automatic planner sessions,
- manually positioned study sessions,
- planner blackouts created when an automatic session is deleted/moved/resized,
- completed workload through the existing study-progress state.

Moving or resizing an automatic study block converts it into a manually positioned study block. The original automatic slot is blacked out so the planner does not immediately recreate the same block. Remaining required minutes are recalculated and placed elsewhere when possible.

### Planner preferences

The existing deterministic planner was extended instead of replaced. Preferences now influence earliest/latest study time, preferred time of day, session length, minimum break, weekend load, and daily study caps.

The planner still uses a 14-day planning horizon. This was preserved from V1 rather than silently changing the planning model.

### Persistence

localStorage remains the persistence mechanism. A hydration guard was added so initial React effects do not overwrite previously saved local data before it has been loaded.

### Markets

The existing Yahoo Finance route was extended to request 1-day / 5-minute chart data. If intraday data is unavailable, the dashboard returns an empty sparkline and shows an unavailable chart state instead of substituting made-up data or silently switching providers.

## Current limitations / future decisions

- Persistence is device/browser-local. Cross-device sync would require a real backend such as Supabase or another user-selected service.
- Native drag/drop is optimized for desktop. Touch-first interaction can be improved later if mobile calendar manipulation becomes a priority.
- Recurring custom events are edited as a series. Per-occurrence exceptions are not yet modeled.
- The planner horizon remains 14 days, so registrar finals with unknown dates cannot be scheduled until exact dates are entered.
- Actual time-spent tracking still uses completed planned-session duration rather than a live timer.
- Yahoo Finance and Google News are unofficial/public endpoints and may occasionally throttle or change.

## Validation performed here

All JavaScript/JSX files were parsed with the TypeScript parser with no syntax diagnostics. A full `next build` could not be completed in this environment because package installation did not finish within the available execution window; run `npm install && npm run build` locally or let Vercel perform the production build after upload.
