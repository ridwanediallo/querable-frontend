# Queryable — Frontend

React 19 + Vite single-page application for **Queryable**, a CrewAI
multi-agent text-to-SQL reporting system. Ask questions in plain English and
get SQL-backed answers with a narrative, KPI cards, and charts.

> **Live application:** [https://querable.io/](https://querable.io/)
>
> This is the **frontend** repository. The API it talks to lives in the
> [querable-backend](https://github.com/ridwanediallo/querable-backend)
> repository — see the [Related repositories](#related-repositories) section.

## Features

- Plain-English question box with session history and follow-up turns
- Rendered SQL, narrative, animated KPI cards, and antv/G2 charts
- PDF and Excel export of query results
- Session-cookie auth with admin-only data-source management and guest quotas
- Dark / light theme (follows the OS until you choose)
- Responsive layout with a datasource switcher

## Tech Stack

- React 19 + Vite + react-router-dom v7
- Ant Design v6, @ant-design/charts (G2), @ant-design/icons
- Zustand for client state, highlight.js for SQL, xlsx/jspdf for export
- Vitest + Testing Library + MSW for tests, oxlint for linting

## Getting Started

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to the backend at `http://127.0.0.1:5001`
(override with `VITE_API_URL`, which only affects the dev proxy). For
production builds, set `VITE_API_BASE` to the backend's absolute origin —
it gets compiled into the client bundle (see `.env.example`). You'll need
the backend running first — see
the [backend README](#related-repositories).

## Scripts

| Command          | Description                          |
|------------------|--------------------------------------|
| `npm run dev`    | Start the Vite dev server            |
| `npm run build`  | Production build to `dist/`          |
| `npm run lint`   | oxlint                               |
| `npm test`       | Run the vitest suite once            |
| `npm run preview`| Preview the production build         |

## Project Layout

```
src/
  App.jsx              # routes + auth bootstrap (fetchMe) + RequireAdmin guard
  api.js               # apiFetch(path, opts) with credentials:'include'
  stores/              # zustand stores (auth, queries, datasources, theme)
  components/          # TopBar, Sidebar, ThemeProvider, KpiCard, ChartSpec, ...
  pages/               # QueryPage, DatasourcePage, LoginPage
  test/                # setup + MSW handlers for /api/v1/*
```

## Auth & API

All requests go through `apiFetch` in `src/api.js` (no raw `fetch`), so the
HttpOnly session cookie is always sent. The backend owns the API contract —
mirror the `routes/` directory in the
[querable-backend](https://github.com/ridwanediallo/querable-backend)
repo. See `AGENTS.md` in this repo for conventions.

## Tests

```bash
npm test
```

MSW intercepts `/api/v1/*`; register new endpoints in
`src/test/mocks/handlers.js`.

## Related Repositories

| Repo | Role |
|------|------|
| [querable-backend](https://github.com/ridwanediallo/querable-backend) | Flask API, CrewAI pipeline, and database tools this app talks to |

## Task Board

See the [Queryable project board](https://github.com/users/ridwanediallo/projects/6)
for the full product backlog, sprint planning, and delivery status.