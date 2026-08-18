import asyncio
import datetime as dt
import re

import httpx

from config import KALSHI_GEO_REGEX, KALSHI_MAX_EVENT_PAGES, KALSHI_OIL_SERIES

API = "https://api.elections.kalshi.com/trade-api/v2"
STRIKE_RX = re.compile(r"above\s+([\d.]+)\s+USD", re.I)
DATE_RX = re.compile(r"on\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})", re.I)


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _mid(m: dict) -> float | None:
    bid, ask = _f(m.get("yes_bid_dollars")), _f(m.get("yes_ask_dollars"))
    if bid is not None and ask is not None:
        return round((bid + ask) / 2 * 100, 2)
    lp = _f(m.get("last_price_dollars"))
    if lp is not None:
        return round(lp * 100, 2)
    if bid is not None:
        return round(bid * 100, 2)
    if ask is not None:
        return round(ask * 100, 2)
    bid_c, ask_c = m.get("yes_bid"), m.get("yes_ask")
    if bid_c is not None and ask_c is not None:
        return (bid_c + ask_c) / 2
    return None


def _vol(m: dict):
    return _f(m.get("volume_fp")) or m.get("volume") or 0


async def _ladder(client: httpx.AsyncClient) -> dict:
    rows = []
    for series in KALSHI_OIL_SERIES:
        cursor = None
        for _ in range(3):
            params = {"series_ticker": series, "status": "open", "limit": 200}
            if cursor:
                params["cursor"] = cursor
            r = await client.get(f"{API}/markets", params=params, timeout=20)
            r.raise_for_status()
            d = r.json()
            for m in d.get("markets", []):
                sm = STRIKE_RX.search(m.get("title", ""))
                dm = DATE_RX.search(m.get("title", ""))
                strike = _f(m.get("floor_strike"))
                if strike is None and sm:
                    strike = _f(sm.group(1))
                if strike is None:
                    continue
                rows.append({
                    "ticker": m.get("ticker"),
                    "title": m.get("title"),
                    "strike": strike,
                    "date": dm.group(1) if dm else "",
                    "prob": _mid(m),
                    "volume": _vol(m),
                })
            cursor = d.get("cursor")
            if not cursor:
                break
    rows = [r for r in rows if r["prob"] is not None]
    by_date: dict[str, list] = {}
    for r in rows:
        by_date.setdefault(r["date"], []).append(r)

    def _pdate(s):
        try:
            return dt.datetime.strptime(s, "%b %d, %Y").date()
        except (ValueError, TypeError):
            return None

    today = dt.date.today()
    qualified = [
        (d_, g) for d_, g in by_date.items()
        if len(g) >= 10 and (_pdate(d_) or dt.date.min) >= today
    ]
    if qualified:
        best_date, group = min(qualified, key=lambda kv: _pdate(kv[0]))
    elif by_date:
        best_date, group = max(by_date.items(), key=lambda kv: len(kv[1]))
    else:
        best_date, group = None, []
    ladder = sorted(group, key=lambda x: x["strike"])
    return {"date": best_date, "points": ladder[:40]}


async def _geo_events(client: httpx.AsyncClient) -> list[dict]:
    rx = re.compile(KALSHI_GEO_REGEX, re.I)
    hits, cursor = [], None
    for _ in range(KALSHI_MAX_EVENT_PAGES):
        params = {"status": "open", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        r = await client.get(f"{API}/events", params=params, timeout=20)
        r.raise_for_status()
        d = r.json()
        for e in d.get("events", []):
            if rx.search(e.get("title", "")):
                hits.append(e)
        cursor = d.get("cursor")
        if not cursor:
            break
    out = []
    for e in hits[:6]:
        try:
            r = await client.get(
                f"{API}/markets",
                params={"event_ticker": e["event_ticker"], "status": "open", "limit": 50},
                timeout=20,
            )
            r.raise_for_status()
            markets = []
            for m in r.json().get("markets", []):
                prob = _mid(m)
                if prob is None:
                    continue
                markets.append({
                    "title": m.get("yes_sub_title") or m.get("title"),
                    "prob": prob,
                    "volume": _vol(m),
                })
            markets.sort(key=lambda m: m["volume"], reverse=True)
            out.append({
                "title": e.get("title"),
                "ticker": e.get("event_ticker"),
                "markets": markets[:8],
            })
        except Exception:
            continue
    return out


async def collect(client: httpx.AsyncClient) -> dict:
    errors = []
    ladder_res, geo_res = await asyncio.gather(
        _ladder(client), _geo_events(client), return_exceptions=True
    )
    if isinstance(ladder_res, Exception):
        errors.append(f"ladder: {ladder_res}")
        ladder_res = {"date": None, "points": []}
    if isinstance(geo_res, Exception):
        errors.append(f"geo: {geo_res}")
        geo_res = []
    ok = bool(ladder_res["points"] or geo_res)
    status = "ok" if (ok and not errors) else ("degraded" if ok else "error")
    return {
        "status": status,
        "data": {"wti_ladder": ladder_res, "geo_events": geo_res},
        "errors": errors,
    }
