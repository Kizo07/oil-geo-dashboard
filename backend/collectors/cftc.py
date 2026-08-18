import datetime as dt
import io
import math
import zipfile

import httpx
import pandas as pd

ZIP_URL = "https://www.cftc.gov/files/dea/history/com_disagg_txt_{year}.zip"
MARKET = "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE"
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}
HIST_WEEKS = 26


async def collect(client: httpx.AsyncClient) -> dict:
    year = dt.date.today().year
    raw = None
    for y in (year, year - 1):
        try:
            r = await client.get(ZIP_URL.format(year=y), headers=HEADERS, timeout=40)
            r.raise_for_status()
            raw = r.content
            break
        except Exception:
            continue
    if raw is None:
        return {"status": "error", "data": {}, "errors": ["CFTC zip unreachable"]}
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
        name = next(n for n in zf.namelist() if n.lower().endswith(".txt"))
        df = pd.read_csv(io.BytesIO(zf.read(name)), low_memory=False)
        required = {
            "Market_and_Exchange_Names", "Report_Date_as_YYYY-MM-DD",
            "M_Money_Positions_Long_All", "M_Money_Positions_Short_All",
            "Open_Interest_All",
        }
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"COT file missing columns: {sorted(missing)}")
        c = df[df["Market_and_Exchange_Names"] == MARKET].copy()
        if c.empty:
            raise ValueError("WTI-PHYSICAL market not found in COT file")
        for col in ("M_Money_Positions_Long_All", "M_Money_Positions_Short_All", "Open_Interest_All"):
            c[col] = pd.to_numeric(c[col], errors="coerce")
        c = c.dropna(subset=["M_Money_Positions_Long_All", "M_Money_Positions_Short_All", "Open_Interest_All"])
        c = c.sort_values("Report_Date_as_YYYY-MM-DD").tail(HIST_WEEKS)
        if c.empty:
            raise ValueError("no numeric COT rows after cleaning")
        rows = []
        for _, r_ in c.iterrows():
            lng = float(r_["M_Money_Positions_Long_All"])
            shr = float(r_["M_Money_Positions_Short_All"])
            oi = float(r_["Open_Interest_All"])
            pct = (lng - shr) / oi * 100 if oi and math.isfinite(oi) else 0.0
            rows.append({
                "date": r_["Report_Date_as_YYYY-MM-DD"],
                "net": lng - shr,
                "long": lng,
                "short": shr,
                "oi": oi,
                "net_pct_oi": round(pct, 2),
            })
        last, prev = rows[-1], rows[-2] if len(rows) > 1 else rows[-1]
        nets = [r["net"] for r in rows]
        pctile = round(sum(1 for n in nets if n <= last["net"]) / len(nets) * 100, 1)
        return {
            "status": "ok",
            "data": {
                "market": "NYMEX WTI crude (futures only, disaggregated)",
                "as_of": last["date"],
                "net": last["net"],
                "change_wow": last["net"] - prev["net"],
                "long": last["long"],
                "short": last["short"],
                "oi": last["oi"],
                "net_pct_oi": last["net_pct_oi"],
                "percentile_26w": pctile,
                "history": rows,
            },
            "errors": [],
        }
    except Exception as e:
        return {"status": "error", "data": {}, "errors": [f"cftc: {type(e).__name__}: {e}"]}
