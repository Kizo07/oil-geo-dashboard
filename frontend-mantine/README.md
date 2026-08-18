# Oil Geo Dashboard — Mantine frontend

New Vite + React 19 + Mantine 9.5.1 frontend for the Oil Geopolitical Signals
Dashboard, built beside the untouched legacy app (`../frontend/` + `../backend/`).
Reuses the existing FastAPI backend (`../backend/app.py`, conda env `oilgeo`) as
the data layer — no backend changes were made.

## Run (development)

```bash
# 1. Start the data backend (legacy, unchanged)
cd .. && ./run.sh            # http://127.0.0.1:8787

# 2. Start the Mantine dev server (proxies /api to the backend)
npm install
npm run dev                  # http://127.0.0.1:5174
```

## Run (production build)

```bash
npm run build                # builds dist/
/opt/anaconda/envs/oilgeo/bin/python serve.py   # http://127.0.0.1:8788
```

`serve.py` serves `dist/` and proxies `/api/*` to the oilgeo backend on
127.0.0.1:8787. The legacy UI remains available at http://127.0.0.1:8787.

## What changed vs the legacy UI

- Same data surface: `/api/dashboard`, `/api/refresh`, `/api/health`, 60 s
  auto-refresh, warm-up (HTTP 202) handling, force-refresh button.
- Same six hash-deep-linkable tabs: Overview · Macro & Rates · Positioning ·
  Supply · Geopolitics · News.
- ECharts retained as the chart engine (gauge, curve, sparklines, COT/Kalshi
  bars, SPR/OVX/VIX/FX/USO lines) — same options as the legacy `js/app.js`.
- All interactive primitives are Mantine: AppShell, Tabs, Badge, Chip (news
  filters), Progress (risk/probability bars), ScrollArea, Skeleton/Loader,
  Alert, ActionIcon, Notifications, light/dark toggle.
- Theme derived from the legacy palette (`src/theme.ts`): amber primary,
  dark navy backgrounds, red/green/cyan/violet signal colors, Inter +
  JetBrains Mono. Defaults to dark to match the legacy look.