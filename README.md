# Oil Geopolitical Signals Dashboard

A local-only web dashboard that aggregates publicly available geopolitical and market signals affecting crude oil futures and distills them into a composite **Oil Geopolitical Risk Index (0–100)**. Data sources include WTI/Brent prices (Yahoo, FRED), prediction markets (Polymarket, Kalshi), news flow (GDELT, RSS), macro rates, positioning (CFTC COT, Baker Hughes rigs, EIA SPR), and EIA inventories (optional key). Status bands: 0–25 Low · 25–45 Elevated · 45–65 High · 65–85 Severe · 85+ Critical.

## Run

Requires conda env `oilgeo` (Python 3.12) created from `environment.yml`:

```bash
conda env create -f environment.yml
./run.sh        # http://127.0.0.1:8787
```

The launcher starts FastAPI/uvicorn on `127.0.0.1:8787` (local-only by design, no auth). Optional: set `EIA_API_KEY` in `backend/.env` to enable EIA inventory data. Cold-start first load takes ~30–60 s; GDELT free tier (1 req/5 s) is handled with spacing, retries, and a 30-min cache.

Optional live vessel traffic (the **Live Traffic** tab): set `AISSTREAM_API_KEY` in `backend/.env` — get a free key at [aisstream.io](https://aisstream.io) with a GitHub login. The backend collects ~45 s AIS position snapshots for both chokepoint zones every 5 min. If the provider is silent or unavailable, the dashboard preserves the last successful snapshot, marks it stale with provider health timestamps, and retries after 60/120/240 seconds before capping at 5 min. During an outage the tab shows an explanatory banner (retries continue in the background) and replaces misleading zero-count native maps with sandboxed VesselFinder live-map embeds plus direct MarineTraffic links, per zone — Strait of Hormuz and Bab el-Mandeb. Resilience is covered by `backend/test_ais_resilience.py` (stale-snapshot merge, retry backoff, display signature). Healthy native maps use MapLibre GL + free CARTO/OpenStreetMap tiles.

## Structure

- `backend/` — FastAPI app (`app.py`), query/weight config (`config.py`), disk cache (`cache.py`), composite scoring (`signals.py`), and one async fail-soft collector per source in `collectors/`
- `frontend/` — hand-built dark "terminal-finance" UI (`index.html`, `css/`, `js/`); Tailwind CDN + ECharts, no build step, auto-refresh 60 s
- `data/cache/` — runtime JSON cache (survives restarts)
- `PLAN.md` — full signal universe, weighting scheme, and architecture notes
