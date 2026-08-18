import asyncio
import io

import httpx
import pandas as pd

from config import FRED_SERIES

URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
HIST = 40


async def _one(client: httpx.AsyncClient, key: str, series: str) -> dict:
    r = await client.get(URL, params={"id": series}, timeout=20)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ["date", "value"]
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna().tail(HIST).reset_index(drop=True)
    if df.empty:
        raise ValueError(f"empty series {series}")
    last = float(df["value"].iloc[-1])
    prev = float(df["value"].iloc[-2]) if len(df) > 1 else last
    mean30 = float(df["value"].mean())
    std_raw = df["value"].std()
    std30 = float(std_raw) if pd.notna(std_raw) and float(std_raw) > 0 else 1.0
    return {
        "series": series,
        "last": last,
        "date": str(df["date"].iloc[-1]),
        "change_1d": round(last - prev, 4),
        "z30": round((last - mean30) / std30, 3),
        "history": [
            {"date": str(d), "value": round(float(v), 4)}
            for d, v in zip(df["date"], df["value"])
        ],
    }


async def collect(client: httpx.AsyncClient) -> dict:
    out, errors = {}, []
    results = await asyncio.gather(
        *[_one(client, k, s) for k, s in FRED_SERIES.items()],
        return_exceptions=True,
    )
    for (k, _), res in zip(FRED_SERIES.items(), results):
        if isinstance(res, Exception):
            errors.append(f"{k}: {res}")
        else:
            out[k] = res
    status = "ok" if not errors else ("degraded" if out else "error")
    return {"status": status, "data": out, "errors": errors}
