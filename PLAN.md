# Oil Geopolitical Signals Dashboard — Project Plan

**Created:** 2026-08-03 · **Status:** Complete (v2 — tabbed UI + 3 signal tiers) · **Scope:** Local-only web dashboard

## 0. v2 additions (2026-08-04)

**Tabbed UI** (hash-deep-linkable, e.g. `/#macro`): Overview · Macro & Rates ·
Positioning · Supply · Geopolitics · News.

**Tier 1 — macro extensions** (all free, keyless): OVX oil volatility index
(FRED `OVXCLS`), 5y/10y inflation breakevens (`T5YIE`/`T10YIE`), 3:2:1 crack
spread (computed from Yahoo `RB=F`, `HO=F`, `CL=F`), Brent–WTI spread,
copper `HG=F`, petro-FX `CAD=X`/`NOK=X`, USO ETF.

**Tier 2 — positioning & supply** (free, keyless): CFTC COT disaggregated
(`com_disagg_txt_YYYY.zip`, market `WTI-PHYSICAL - NEW YORK MERCANTILE
EXCHANGE`, managed-money long/short → net, net/OI, 26w percentile); Baker
Hughes rig count (scrape `na-rig-count` page → latest `/static-files/<uuid>`
xlsx → NAM Summary sheet: US oil/gas/total, w/w, y/y); SPR weekly stocks
(EIA dnav `WCSSTUS1w.xls`, no key — 52w history + percentile).

**Tier 3 — emerging signals** (GDELT + RSS keyword heat): tanker war-risk
premiums, floating storage / oil-on-water, China crude imports, OPEC+ spare
capacity, Gulf of Mexico hurricane risk. Surfaced as heat bars on Overview
and detail cards on Supply/Geopolitics tabs.

OVX now feeds the macro risk component (oil-specific fear gauge weighted
alongside VIX).

## 1. Goal

A beautiful, locally-running dashboard that aggregates **publicly available
geopolitical and market signals affecting crude oil futures**, and distills
them into a composite **Oil Geopolitical Risk Index (0–100)**.

## 2. Signal Universe & Data Sources (all verified live on 2026-08-03)

| # | Signal | Source | Access | Notes |
|---|--------|--------|--------|-------|
| 1 | **WTI futures curve** (contango/backwardation, real contract months) | Yahoo Finance chart API (`CLU26.NYM`, `CLV26.NYM`, …) | Free, no key | Full curve: Sep-26 → Jun-27 verified. Curve shape = supply-fear proxy |
| 2 | **WTI/Brent spot & history** | FRED (`DCOILWTICO`, `DCOILBRENTEU`) | Free, no key | Daily, EIA-sourced |
| 3 | **Prediction markets — oil prices** | Polymarket Gamma API (`/events/746379` "What will WTI hit in August 2026?") | Free, no key | Implied prob of hitting $95/$105… and falling to $75/$65 |
| 4 | **Prediction markets — Hormuz shipping** | Polymarket ("Strait of Hormuz traffic returns to normal by Dec 31?", weekly ship-transit count markets) | Free, no key | Direct chokepoint crowd-estimate |
| 5 | **Prediction markets — conflict** | Polymarket ("US invade Iran before 2027?" $55M vol, "Israel x Iran ceasefire continues", "US x Iran effective ceasefire") | Free, no key | Escalation probabilities |
| 6 | **Prediction markets — OPEC/other** | Polymarket ("another country leaves OPEC in 2026?", "OPEC dissolves in 2026?") | Free, no key | Supply-policy risk |
| 7 | **Kalshi WTI settlement ladder** | Kalshi API v2 (`series_ticker=KXWTI`) | Free, no key | Daily "WTI above $X" strike ladder → implied distribution |
| 8 | **Kalshi geopolitical events** | Kalshi API v2 events scan (keyword filter, paginated) | Free, no key | Any open Iran/Hormuz/oil markets |
| 9 | **News flow & tone per chokepoint** | GDELT DOC 2.0 API | Free, no key | Rate limit: 1 req / 5 s → queries serialized, 30-min cache. Tone score built in |
| 10 | **Headlines** | Google News RSS (query feeds: hormuz, houthi red sea, iran oil, opec…), Al Jazeera RSS, BBC Middle East RSS | Free | Deduped, keyword-tagged, lexicon-scored |
| 11 | **US Treasury moves** | FRED (`DGS2`, `DGS5`, `DGS10`, `DGS30`) | Free, no key | Daily Δ, 2s10s slope — rates/growth signal |
| 12 | **Dollar (DXY proxy)** | FRED `DTWEXBGS` (broad goods index) | Free, no key | USD strength = oil headwind |
| 13 | **Risk appetite** | FRED `VIXCLS` | Free, no key | Risk-off gauge |
| 14 | **Gold** | Yahoo `GC=F` | Free | Safe-haven cross-check |
| 15 | **EIA inventories** (optional) | EIA API v2 | Free key; `DEMO_KEY` unreliable from this network | Graceful degradation; user can set `EIA_API_KEY` |

**Rejected during research:** CME direct curve JSON (IP-blocked), ACLED
(requires registration token), MarineTraffic/AIS (paid) — Polymarket ship-
transit markets act as the free AIS proxy.

## 3. Composite Risk Index (0–100)

Weighted blend, each component normalized 0–100:

| Component | Weight | Derived from |
|-----------|--------|--------------|
| Chokepoint disruption (Hormuz, Bab el-Mandeb/Red Sea) | 30% | GDELT tone/volume + RSS keyword hits + Polymarket "traffic normal" prob (inverted) |
| Conflict escalation (Iran/Israel/US) | 25% | Polymarket invasion/ceasefire probs, GDELT tone |
| Futures curve stress | 15% | Backwardation depth (front vs 12th month %), spike vs 30d baseline |
| Prediction-market price risk | 15% | Polymarket P(WTI ≥ $95/$105), Kalshi ladder skew |
| Macro risk-off | 10% | VIX z-score, DXY daily Δ, 2s10s move |
| News temperature | 5% | Headline volume vs trailing baseline |

Status bands: 0–25 Low · 25–45 Elevated · 45–65 High · 65–85 Severe · 85+ Critical.

## 4. Architecture

```
oil-geo-dashboard/
├── PLAN.md
├── environment.yml            # conda env spec
├── run.sh                     # one-command launcher
├── backend/
│   ├── app.py                 # FastAPI: serves frontend + /api/*
│   ├── config.py              # queries, weights, TTLs
│   ├── cache.py               # disk JSON cache w/ TTL (survives restarts)
│   ├── signals.py             # normalization + composite scoring
│   └── collectors/            # one module per source, all async, all fail-soft
│       ├── fred.py  yahoo.py  polymarket.py  kalshi.py  gdelt.py  news.py  eia.py
├── frontend/
│   ├── index.html  css/style.css  js/app.js
└── data/cache/                # runtime cache
```

- **Backend:** FastAPI + httpx (async), pandas for series math, feedparser
  for RSS. Every collector returns `{status: ok|degraded|error}` so the UI
  always renders. GDELT calls serialized ≥5.2 s apart; TTL cache 30 min.
- **Refresh model:** `/api/dashboard` serves cache instantly; a background
  task refreshes when stale (TTL 5 min, GDELT 30 min); `POST /api/refresh`
  forces it.
- **Frontend:** hand-built dark "terminal-finance" UI — Tailwind (CDN) +
  ECharts. No build step. Auto-refresh 60 s.

### UI layout
1. **Header strip** — WTI/Brent live prices, curve-state badge
   (BACKWARDATION/CONTANGO + depth), composite risk gauge.
2. **Chokepoint cards** — Hormuz, Bab el-Mandeb/Red Sea: risk bar, latest
   headlines, Polymarket traffic-normal prob.
3. **Prediction markets** — Polymarket cards (conflict, Hormuz, WTI hits,
   OPEC) with prob bars & volumes; Kalshi WTI ladder chart.
4. **Futures curve** — ECharts line, real contract months, backwardation
   shading + 30d history of front–back spread.
5. **Macro panel** — 2y/5y/10y/30y yields, 2s10s, DXY, VIX, gold sparklines.
6. **News feed** — deduped, source chips, sentiment coloring, GDELT mention-
   volume timeline.

## 5. Environment

Conda env `oilgeo` (Python 3.12): `fastapi uvicorn httpx pandas feedparser`
(frontend libs via CDN — no node build). Optional: `EIA_API_KEY` in
`backend/.env` for inventories.

## 6. Execution checklist

- [x] Probe & verify every data source (results in §2)
- [x] Scaffold project tree
- [x] Conda env `oilgeo` + packages (python 3.12, fastapi, uvicorn, httpx, pandas, feedparser)
- [x] Collectors (fail-soft, cached) — verified live: fred/yahoo/polymarket/kalshi/news OK, gdelt rate-limited (retries + backoff), eia needs user key
- [x] Signal engine + composite index (live reading: 34.3 "Elevated", curve backwardation 13%)
- [x] FastAPI app + endpoints (`/api/dashboard`, `/api/refresh`, `/api/health`)
- [x] Frontend (dark UI, ECharts gauge/curve/ladder/sparklines, auto-refresh 60s)
- [x] End-to-end run + verification (headless Chromium screenshot, all panels populated)

## 6.1 Running it

```bash
# foreground
./run.sh                        # http://127.0.0.1:8787

# as a user service (already set up on this machine)
systemctl --user status oilgeo-server
systemctl --user restart oilgeo-server
journalctl --user -u oilgeo-server -f

# optional: free EIA API key for inventory data
export EIA_API_KEY=***   # then restart
```

First load after a cold start takes ~30–60 s (collectors + GDELT spacing);
the UI shows a warm-up notice and polls until ready. GDELT free tier is 1
req/5 s — the collector spaces queries 6.5 s, retries on 429, caches 30 min,
and merges partial results across refresh cycles.

## 7. Known limitations

- GDELT free tier: 1 req/5 s, 30-min cache acceptable for a dashboard.
- Yahoo futures quotes can lag/miss distant months → curve collector skips
  missing months gracefully.
- CME blocks scraping → curve via Yahoo contract months instead.
- Polymarket/Kalshi probabilities are crowd estimates, not ground truth.
- EIA inventories need a free personal API key for reliability.
- Local-only by design (no auth, binds 127.0.0.1).
