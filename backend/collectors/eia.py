import io
import math
import os

import httpx
import pandas as pd

SPR_XLS = "https://www.eia.gov/dnav/pet/hist_xls/WCSSTUS1w.xls"
INV_URL = "https://api.eia.gov/v2/petroleum/sum/sndw/data"
INV_SERIES = "WCRSTUS1"  # U.S. Ending Stocks of Crude Oil (thousand barrels), weekly WPSR
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}
SPR_HIST_WEEKS = 52


def _first_date_row(df: pd.DataFrame) -> int:
    for i in range(min(len(df), 20)):
        try:
            pd.Timestamp(df.iloc[i, 0])
            return i
        except (ValueError, TypeError):
            continue
    raise ValueError("SPR sheet: no date row found in first 20 rows")


async def _spr(client: httpx.AsyncClient) -> dict:
    r = await client.get(SPR_XLS, headers=HEADERS, timeout=30)
    r.raise_for_status()
    df = pd.ExcelFile(io.BytesIO(r.content)).parse("Data 1", header=None)
    data = df.iloc[_first_date_row(df):].copy()
    data = data.dropna(subset=[1])
    data[1] = pd.to_numeric(data[1], errors="coerce")
    data = data.dropna(subset=[1]).tail(SPR_HIST_WEEKS)
    if len(data) < 2:
        raise ValueError("SPR sheet too short")
    rows = [
        {"period": str(pd.Timestamp(d).date()), "value": float(v)}
        for d, v in zip(data[0], data[1])
    ]
    last, prev, year_ago = rows[-1]["value"], rows[-2]["value"], rows[0]["value"]
    return {
        "unit": "thousand barrels",
        "as_of": rows[-1]["period"],
        "last_mb": round(last / 1000, 2),
        "change_wow_mb": round((last - prev) / 1000, 2),
        "change_52w_mb": round((last - year_ago) / 1000, 2),
        "history": [{"period": x["period"], "value": round(x["value"] / 1000, 2)} for x in rows],
    }


async def _inventories(client: httpx.AsyncClient) -> dict:
    key = os.environ.get("EIA_API_KEY")
    if not key:
        return {"status": "no_key", "note": "Set EIA_API_KEY (free at eia.gov) for weekly commercial inventories."}
    params = {
        "api_key": key,
        "frequency": "weekly",
        "data[0]": "value",
        "facets[series][]": INV_SERIES,
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": "16",
    }
    r = await client.get(INV_URL, params=params, timeout=25)
    r.raise_for_status()
    data = r.json().get("response", {}).get("data")
    if not data:
        raise RuntimeError(f"no data: {str(r.json())[:120]}")
    rows = []
    for row in data[-16:]:
        try:
            val = float(row.get("value"))
        except (TypeError, ValueError):
            continue
        if math.isfinite(val):
            rows.append({"period": row.get("period"), "value": val})
    if not rows:
        raise RuntimeError("API returned no recent values")
    rows.sort(key=lambda x: str(x.get("period", "")))  # v2 returns newest-first
    last = rows[-1]["value"]
    prev = rows[-2]["value"] if len(rows) > 1 else last
    return {"status": "ok", "last": last, "change_wow": round(last - prev, 1), "history": rows}


async def collect(client: httpx.AsyncClient) -> dict:
    errors = []
    spr = None
    try:
        spr = await _spr(client)
    except Exception as e:
        errors.append(f"spr: {type(e).__name__}: {e}")
    try:
        inv = await _inventories(client)
        if inv.get("status") == "no_key":
            errors.append("inventories: no EIA_API_KEY")
    except Exception as e:
        inv = {"status": "error"}
        errors.append(f"inventories: {type(e).__name__}: {e}")
    status = "ok" if spr else ("degraded" if inv.get("status") == "ok" else "error")
    return {"status": status, "data": {"spr": spr, "inventories": inv}, "errors": errors}
