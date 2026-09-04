import asyncio
import datetime as dt
import json
import os

import websockets

from config import (
    AISSTREAM_WS,
    AIS_COLLECT_WINDOW_S,
    AIS_MAX_VESSELS_PER_ZONE,
    AIS_ZONES,
)

NAV_STATUS = {
    0: "underway (engine)",
    1: "anchored",
    2: "not commanding",
    3: "restricted manoeuvre",
    4: "constrained by draught",
    5: "moored",
    6: "aground",
    7: "fishing",
    8: "underway (sail)",
    15: "undefined",
}
ANCHORED_STATUSES = {"anchored", "moored", "aground", "not commanding"}


def _safe_error(message: object, access_value: str | None) -> str:
    text = str(message)
    if access_value:
        text = text.replace(access_value, "[redacted]")
    return text[:500]


def _f(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def _zone_for(lat: float, lon: float) -> str | None:
    for key, z in AIS_ZONES.items():
        (lat_min, lon_min), (lat_max, lon_max) = z["bbox"]
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return key
    return None


def _empty_zone(key: str) -> dict:
    return {
        "name": AIS_ZONES[key]["name"],
        "bbox": [list(corner) for corner in AIS_ZONES[key]["bbox"]],
        "center": AIS_ZONES[key]["center"],
        "zoom": AIS_ZONES[key]["zoom"],
        "count": 0,
        "n_moving": 0,
        "n_anchored": 0,
        "avg_sog": None,
        "vessels": [],
    }


async def collect(api_key: str | None = None) -> dict:
    api_key = api_key or os.environ.get("AISSTREAM_API_KEY")
    if not api_key:
        note = "Set AISSTREAM_API_KEY (free at aisstream.io) for live vessel traffic."
        data = {"as_of": None, "window_s": 0, "note": note,
                "zones": {k: _empty_zone(k) for k in AIS_ZONES}}
        return {"status": "no_key", "data": {**data, "status": "no_key"}, "errors": []}

    boxes = [[list(corner) for corner in z["bbox"]] for z in AIS_ZONES.values()]
    by_zone: dict[str, dict[str, dict]] = {k: {} for k in AIS_ZONES}
    errors: list[str] = []
    loop = asyncio.get_running_loop()
    deadline = loop.time() + AIS_COLLECT_WINDOW_S

    try:
        async with websockets.connect(AISSTREAM_WS, open_timeout=15, close_timeout=5) as ws:
            await ws.send(json.dumps({
                "APIKey": api_key,
                "BoundingBoxes": boxes,
                "FilterMessageTypes": ["PositionReport"],
            }))
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0 or sum(len(z) for z in by_zone.values()) >= 4000:
                    break
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                except asyncio.TimeoutError:
                    break
                try:
                    msg = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(msg, dict):
                    continue
                if msg.get("error"):
                    errors.append(str(msg["error"]))
                    break
                if msg.get("MessageType") != "PositionReport":
                    continue
                pr = (msg.get("Message") or {}).get("PositionReport") or {}
                meta = msg.get("MetaData") or {}
                lat, lon = _f(pr.get("Latitude")), _f(pr.get("Longitude"))
                if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    continue
                zone = _zone_for(lat, lon)
                if zone is None:
                    continue
                mmsi = str(meta.get("MMSI") or pr.get("UserID") or "")
                if not mmsi:
                    continue
                sog = _f(pr.get("Sog"))
                if sog is None or sog > 40:  # 102.3 marks "not available"
                    sog = None
                nav_raw = pr.get("NavigationalStatus")
                status = NAV_STATUS.get(nav_raw if isinstance(nav_raw, int) else -1, "unknown")
                by_zone[zone][mmsi] = {
                    "mmsi": int(mmsi) if mmsi.isdigit() else mmsi,
                    "name": (meta.get("ShipName") or "").strip() or None,
                    "lat": round(lat, 4),
                    "lon": round(lon, 4),
                    "sog": round(sog, 1) if sog is not None else None,
                    "cog": _f(pr.get("Cog")),
                    "nav_status": status,
                }
    except Exception as e:
        errors.append(f"{type(e).__name__}: {e}")

    zones_out = {}
    for key in AIS_ZONES:
        vs = list(by_zone[key].values())
        sogs = [v["sog"] for v in vs if v["sog"] is not None]
        out = _empty_zone(key)
        out.update({
            "count": len(vs),
            "n_moving": sum(1 for v in vs if v["sog"] is not None and v["sog"] >= 1),
            "n_anchored": sum(
                1 for v in vs
                if v["nav_status"] in ANCHORED_STATUSES or (v["sog"] is not None and v["sog"] < 1)
            ),
            "avg_sog": round(sum(sogs) / len(sogs), 1) if sogs else None,
            "vessels": vs[:AIS_MAX_VESSELS_PER_ZONE],
        })
        zones_out[key] = out

    total = sum(z["count"] for z in zones_out.values())
    if total > 0:
        status = "ok" if not errors else "degraded"
    elif errors:
        status = "error"
    else:
        # Connected + authenticated but the feed delivered nothing —
        # typically an aisstream.io-side outage (free beta, no SLA).
        status = "empty"
        errors.append("provider accepted the subscription but delivered no positions")
    errors = [_safe_error(error, api_key) for error in errors]
    data = {
        "status": status,
        "as_of": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "window_s": AIS_COLLECT_WINDOW_S,
        "zones": zones_out,
    }
    if errors:
        data["note"] = errors[0]
    return {"status": status, "data": data, "errors": errors}
