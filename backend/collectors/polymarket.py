import asyncio
import re

import httpx

from config import CHOKEPOINTS, PM_MAX_EVENTS, PM_SEARCH_QUERIES

GAMMA = "https://gamma-api.polymarket.com"

CAT_RULES = [
    ("chokepoint", re.compile(r"hormuz|red sea|houthi|bab el-mandeb|suez|tanker|ship|transit|strait", re.I)),
    ("oil-price", re.compile(r"wti|brent|crude|oil price|oil hit", re.I)),
    ("conflict", re.compile(r"iran|israel|invade|strike|ceasefire|war|attack|conflict", re.I)),
    ("opec", re.compile(r"opec", re.I)),
    ("sanctions", re.compile(r"sanction|embargo|venezuela|russia", re.I)),
]


def _classify(title: str) -> str:
    for cat, rx in CAT_RULES:
        if rx.search(title):
            return cat
    return "other"


def _yes_prob(market: dict) -> float | None:
    prices = market.get("outcomePrices")
    if not prices:
        return None
    try:
        if isinstance(prices, str):
            prices = [p.strip('"') for p in prices.strip("[]").split(",")]
        return round(float(prices[0]) * 100, 2)
    except Exception:
        return None


async def _search(client: httpx.AsyncClient, q: str) -> list[dict]:
    r = await client.get(
        f"{GAMMA}/public-search",
        params={"q": q, "limit_per_type": 5},
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("events") or []


async def _event_detail(client: httpx.AsyncClient, eid: str) -> dict:
    r = await client.get(f"{GAMMA}/events/{eid}", timeout=20)
    r.raise_for_status()
    return r.json()


async def collect(client: httpx.AsyncClient) -> dict:
    errors, seen, events = [], set(), []
    results = await asyncio.gather(
        *[_search(client, q) for q in PM_SEARCH_QUERIES], return_exceptions=True
    )
    for q, res in zip(PM_SEARCH_QUERIES, results):
        if isinstance(res, Exception):
            errors.append(f"search '{q}': {res}")
            continue
        for e in res:
            if e.get("closed") or e["id"] in seen:
                continue
            seen.add(e["id"])
            events.append(e)

    events.sort(key=lambda e: float(e.get("volume") or 0), reverse=True)
    top, seen_ids = [], set()
    for e in events:
        if len(top) >= 10:
            break
        top.append(e)
        seen_ids.add(e["id"])
    for cat in ("oil-price", "chokepoint", "conflict", "opec", "sanctions"):
        n = 0
        for e in events:
            if n >= 2:
                break
            if e["id"] not in seen_ids and _classify(e.get("title", "")) == cat:
                top.append(e)
                seen_ids.add(e["id"])
                n += 1
    top = top[:PM_MAX_EVENTS + 6]
    details = await asyncio.gather(
        *[_event_detail(client, e["id"]) for e in top], return_exceptions=True
    )

    pm_events = []
    for e, d in zip(top, details):
        if isinstance(d, Exception):
            errors.append(f"event {e['id']}: {d}")
            continue
        markets = []
        for m in d.get("markets", []):
            prob = _yes_prob(m)
            if prob is None:
                continue
            markets.append({
                "question": m.get("question") or m.get("groupItemTitle") or "",
                "prob": prob,
                "volume": round(float(m.get("volume") or 0)),
            })
        markets.sort(key=lambda m: m["volume"], reverse=True)
        pm_events.append({
            "id": e["id"],
            "title": d.get("title") or e.get("title"),
            "category": _classify(d.get("title") or e.get("title") or ""),
            "volume": round(float(e.get("volume") or 0)),
            "liquidity": round(float(e.get("liquidity") or 0)),
            "end": (e.get("endDate") or "")[:10],
            "url": f"https://polymarket.com/event/{e.get('slug', '')}",
            "markets": markets[:12],
        })

    chokepoint_probs = {}
    for cp_id, cp in CHOKEPOINTS.items():
        best = None
        for e in pm_events:
            if e["category"] != "chokepoint":
                continue
            hay = e["title"].lower()
            if not any(k in hay for k in cp["pm_keywords"]):
                continue
            if best is None or e["volume"] > best["volume"]:
                best = e
        if best:
            chokepoint_probs[cp_id] = {
                "title": best["title"],
                "volume": best["volume"],
                "markets": best["markets"][:6],
                "url": best["url"],
            }

    status = "ok" if not errors else ("degraded" if pm_events else "error")
    return {
        "status": status,
        "data": {"events": pm_events, "chokepoint_probs": chokepoint_probs},
        "errors": errors,
    }
