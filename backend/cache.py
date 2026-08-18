import json
import os
import time
from pathlib import Path

from config import CACHE_DIR


def _path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def get(key: str, ttl: int) -> dict | None:
    p = _path(key)
    if not p.exists():
        return None
    try:
        raw = json.loads(p.read_text())
    except Exception:
        return None
    if time.time() - raw.get("_ts", 0) > ttl:
        return None
    return raw.get("data")


def get_stale(key: str) -> dict | None:
    p = _path(key)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text()).get("data")
    except Exception:
        return None


def put(key: str, data: dict) -> None:
    p = _path(key)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps({"_ts": time.time(), "data": data}, default=str))
    os.replace(tmp, p)


def ts(key: str) -> float | None:
    p = _path(key)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text()).get("_ts")
    except Exception:
        return None
