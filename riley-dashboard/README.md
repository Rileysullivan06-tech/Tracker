# Riley Dashboard

A personal school/work/life dashboard for Fall 2026.

## What is already built

- Recurring class schedule for GNED 1202, MGMT 3230, ACCT 3224 and FNCE 3227.
- Recurring work schedule: Tue 5:00–9:15 PM, Wed 4:00 PM–12:00 AM, Thu 4:45 PM–12:00 AM.
- Audited assessment/deadline database from the four course outlines.
- Smart Study Planner that estimates preparation time and auto-schedules sessions around fixed commitments.
- Manual override for every study-time estimate.
- Weekly calendar and Today view.
- Persistent personal to-do list using browser localStorage.
- Persistent completed study/deadline states using browser localStorage.
- Portfolio watchlist with server-side Yahoo Finance quote retrieval.
- Daily Top + Markets headlines via server-side Google News RSS retrieval.
- Responsive dark dashboard UI.

## Run locally

1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Deploy to Vercel

1. Put this folder in a GitHub repository.
2. Import that repository into Vercel.
3. Accept the default Next.js settings and deploy.
4. Bookmark the Vercel URL.

No API keys are required for the current live quote/news implementation. The feeds are third-party public endpoints and can occasionally throttle or change. The UI handles failed rows without breaking the dashboard.

## Data/persistence note

Tasks, completed items, and study-estimate overrides are stored in browser localStorage. That means they persist on the same browser/device. A later version can swap this for Supabase if cross-device sync/login is desired.

## Important academic-data note

The source outlines leave some dates unknown or D2L-only. Those are intentionally not invented:
- GNED participation activity dates are on D2L.
- GNED detailed reading dates/last-minute changes are on D2L.
- Registrar-set final exam dates remain TBD.
- Business Law's Fall schedule says the final window is Dec 11–21, while another sentence in the outline incorrectly references Apr 15–25. The dashboard therefore keeps the exact final date as TBD.
