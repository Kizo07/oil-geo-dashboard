import asyncio
import datetime as dt

import httpx

from config import YAHOO_CURVE_MONTHS, YAHOO_EXTRAS, YAHOO_KEEP_MONTHS

CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"]
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}


def _curve_symbols() -> list[dict]:
    today = dt.date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(YAHOO_CURVE_MONTHS):
        m += 1
        if m > 12:
            m, y = 1, y + 1
        sym = f"CL{MONTH_CODES[m - 1]}{y % 100}.NYM"
        label = f"{dt.date(y, m, 1):%b-%y}"
        out.append({"symbol": sym, "contract": label})
    return out


async def _quote(client: httpx.AsyncClient, sym: str, rng: str = "1d") -> dict:
    r = await client.get(
        CHART.format(sym=sym),
        params={"range": rng, "interval": "1d"},
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    meta = res["meta"]
    price = meta.get("regularMarketPrice")
    if price is None:
        raise ValueError(f"no price for {sym}")
    out = {"symbol": sym, "price": float(price)}
    if rng != "1d":
        ts = res.get("timestamp") or []
        closes = res["indicators"]["quote"][0].get("close") or []
        out["history"] = [
            {"date": dt.datetime.fromtimestamp(t, tz=dt.timezone.utc).strftime("%Y-%m-%d"), "value": round(c, 3)}
            for t, c in zip(ts, closes)
            if c is not None
        ]
    return out


async def _curve(client: httpx.AsyncClient) -> list[dict]:
    cands = _curve_symbols()
    res = await asyncio.gather(
        *[_quote(client, c["symbol"]) for c in cands], return_exceptions=True
    )
    curve = []
    for c, q in zip(cands, res):
        if isinstance(q, Exception):
            continue
        curve.append({"contract": c["contract"], "symbol": c["symbol"], "price": q["price"]})
        if len(curve) >= YAHOO_KEEP_MONTHS:
            break
    return curve


async def collect(client: httpx.AsyncClient) -> dict:
    errors = []
    curve, quotes, extras = [], {}, {}
    tasks = [
        _curve(client),
        _quote(client, "CL=F", "1mo"),
        _quote(client, "BZ=F", "1mo"),
        _quote(client, "GC=F", "1mo"),
    ]
    extra_keys = list(YAHOO_EXTRAS.items())
    tasks += [_quote(client, sym, "1mo") for _, sym in extra_keys]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    curve_res, front_res, brent_res, gold_res = results[:4]
    if isinstance(curve_res, Exception):
        errors.append(f"curve: {curve_res}")
    else:
        curve = curve_res
    for name, res in (("wti_front", front_res), ("brent_front", brent_res), ("gold", gold_res)):
        if isinstance(res, Exception):
            errors.append(f"{name}: {res}")
        else:
            quotes[name] = res
    for (name, _), res in zip(extra_keys, results[4:]):
        if isinstance(res, Exception):
            errors.append(f"{name}: {res}")
        else:
            extras[name] = res

    curve_state = None
    if len(curve) >= 3:
        front, back = curve[0]["price"], curve[-1]["price"]
        if not back:
            return {
                "status": "degraded" if (curve or quotes) else "error",
                "data": {"curve": curve, "curve_state": None, "quotes": quotes, "extras": extras},
                "errors": errors + ["curve_state: back-month price is zero"],
            }
        depth = (front - back) / back * 100
        curve_state = {
            "regime": "backwardation" if front > back else "contango",
            "depth_pct": round(depth, 2),
            "front_contract": curve[0]["contract"],
            "back_contract": curve[-1]["contract"],
            "front_price": front,
            "back_price": back,
            "n_contracts": len(curve),
        }
    status = "ok" if not errors else ("degraded" if (curve or quotes) else "error")
    return {
        "status": status,
        "data": {"curve": curve, "curve_state": curve_state, "quotes": quotes, "extras": extras},
        "errors": errors,
    }
