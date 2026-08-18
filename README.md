# Oil Geopolitical Signals Dashboard

A local-only web dashboard that aggregates publicly available geopolitical and market signals affecting crude oil futures and distills them into a composite **Oil Geopolitical Risk Index (0–100)**. Data sources include WTI/Brent prices (Yahoo, FRED), prediction markets (Polymarket, Kalshi), news flow (GDELT, RSS), macro rates, positioning (CFTC COT, Baker Hughes rigs, EIA SPR), and EIA inventories (optional key). Status bands: 0–25 Low · 25–45 Elevated · 45–65 High · 65–85 Severe · 85+ Critical.

## Run

Requires conda env `oilgeo` (Python 3.12) created from `environment.yml`:

```bash
conda env create -f environment.yml
./run.sh        # http://127.0.0.1:8787
```

The launcher starts FastAPI/uvicorn on `127.0.0.1:8787` (local-only by design, no auth). Optional: set `EIA_API_KEY` in `backend/.env` to enable EIA inventory data. Cold-start first load takes ~30–60 s; GDELT free tier (1 req/5 s) is handled with spacing, retries, and a 30-min cache.

## Structure

- `backend/` — FastAPI app (`app.py`), query/weight config (`config.py`), disk cache (`cache.py`), composite scoring (`signals.py`), and one async fail-soft collector per source in `collectors/`
- `frontend/` — hand-built dark "terminal-finance" UI (`index.html`, `css/`, `js/`); Tailwind CDN + ECharts, no build step, auto-refresh 60 s
- `data/cache/` — runtime JSON cache (survives restarts)
- `PLAN.md` — full signal universe, weighting scheme, and architecture notes
