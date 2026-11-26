# LifeTracker — Frontend

The web frontend for [LifeTracker](../LifeTracker). It shows your personal data — sleep, heart rate, stress, activity, receipts(WIP), indoor climate, weather, and activity-watch(Demo disabled) time-in-front-of-screens — as charts and day/week/month views you can step through.

Built with React 19 + TypeScript, bundled by Vite. Routing via react-router, charts with Recharts, date picking with react-day-picker.

## How it talks to the API

All data comes from the LifeTracker backend (ASP.NET) over `/api/...` (plus `/azure-api/...` for a couple of Azure Functions endpoints). The frontend is same-origin by design — the backend serves the built frontend directly, so no CORS is involved.

- **Dev:** the Vite dev server proxies `/api` → `http://127.0.0.1:5071` and `/azure-api` → the Azure Functions app (see `vite.config.ts`).
- **Prod:** run `npm run build` and serve `dist/` from the backend's `wwwroot`.

You can override the API origin with `VITE_API_BASE`, but note the backend has no CORS policy, so that only works same-origin or through a proxy.

Login is password-based (a JWT is kept in `sessionStorage`); the dev backend accepts the password `demo`.

## Getting started

1. Make sure the backend is running (default: `http://127.0.0.1:5071`).
2. `npm install`
3. `npm run dev` → open `http://localhost:5173`, log in.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR + API proxying |
| `npm run build` | Type-check (`tsc -b`) then produce the production bundle in `dist/` |
| `npm run lint` | ESLint over the whole project |
| `npm run preview` | Serve the built `dist/` locally |

## Layout

- `src/pages/` — one component per route (`/home`, `/day`, `/sleep`, `/heartrate`, `/stress`, `/climate`, `/weather`, `/inside-outside`, `/receipt`)
- `src/charts.tsx` — all Recharts chart components
- `src/api/` — typed fetch wrappers around the backend
- `src/dates.ts`, `src/range.ts`, `src/useRange.ts` — date/range helpers (ISO dates, week/month stepping)
- `src/dataCache.ts`, `src/garminCache.ts` — localStorage caching with background live refresh
- `src/auth/` — JWT login/session handling

## Notes

- Pages read their selected date from the URL (`?date=`), so any view is directly linkable. Future dates are clamped to today everywhere (picker, route param, and stepper).
- The home page shows a live-updating view of the current day/week/month with heart rate and sleep charts; clicking a day in a chart jumps to that day's detail page.
