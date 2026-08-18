import io
import re

import httpx
import pandas as pd

PAGE = "https://rigcount.bakerhughes.com/na-rig-count"
FILE_RX = re.compile(
    r'href="(/static-files/[0-9a-f-]+)"[^>]*title="([^"]*North[_ ]?America\s*Rig[_ ]?Count[^"]*)"',
    re.I,
)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    "Referer": PAGE,
}


def _num(v):
    n = pd.to_numeric(v, errors="coerce")
    return float(n) if pd.notna(n) else None


def _summary_value(df: pd.DataFrame, label: str) -> tuple:
    for i in range(len(df)):
        if str(df.iloc[i, 1]).strip().lower() == label.lower():
            week = _num(df.iloc[i, 3])
            if week is None:
                continue
            wow = _num(df.iloc[i, 4])
            year_ago = _num(df.iloc[i, 7]) if df.shape[1] > 7 else None
            yoy = round(week - year_ago) if year_ago is not None else None
            return week, wow, yoy
    return None, None, None


async def collect(client: httpx.AsyncClient) -> dict:
    try:
        r = await client.get(PAGE, headers=HEADERS, timeout=30, follow_redirects=True)
        r.raise_for_status()
        matches = FILE_RX.findall(r.text)
        if not matches:
            raise ValueError("rig count xlsx link not found")
        path, title = matches[0]
        m = re.search(r"(\d{2}-\d{2}-\d{4})", title)
        as_of = m.group(1) if m else ""
        r2 = await client.get(
            f"https://rigcount.bakerhughes.com{path}",
            headers=HEADERS,
            timeout=60,
            follow_redirects=True,
        )
        r2.raise_for_status()
        xf = pd.ExcelFile(io.BytesIO(r2.content))
        df = xf.parse("NAM Summary", header=None)
        us_total, us_total_wow, us_total_yoy = _summary_value(df, "United States Total")
        us_oil, us_oil_wow, us_oil_yoy = _summary_value(df, "Oil")
        us_gas, us_gas_wow, us_gas_yoy = _summary_value(df, "Gas")
        if us_total is None and us_oil is None:
            raise ValueError("could not parse NAM Summary sheet")
        return {
            "status": "ok",
            "data": {
                "as_of": as_of,
                "us_total": us_total,
                "us_total_wow": us_total_wow,
                "us_total_yoy": us_total_yoy,
                "us_oil": us_oil,
                "us_oil_wow": us_oil_wow,
                "us_oil_yoy": us_oil_yoy,
                "us_gas": us_gas,
                "us_gas_wow": us_gas_wow,
                "us_gas_yoy": us_gas_yoy,
            },
            "errors": [],
        }
    except Exception as e:
        return {"status": "error", "data": {}, "errors": [f"rigcount: {type(e).__name__}: {e}"]}
