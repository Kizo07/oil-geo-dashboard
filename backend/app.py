import asyncio
import os
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import cache
import signals
from collectors import ais, cftc, eia, fred, gdelt, kalshi, news, polymarket, rigcount, yahoo
from config import AIS_TTL, BASE_DIR, GDELT_QUERIES, TTL_DEFAULT, TTL_GDELT

GDELT_BACKOFF = 600

_lock = asyncio.Lock()
_refreshing = False
_last_error = None
_bg_tasks: set = set()


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


def _norm(res, name) -> dict:
    if isinstance(res, BaseException):
        return {"status": "error", "data": {}, "errors": [f"{name}: {type(res).__name__}: {res}"]}
    return res


def _build_and_cache(fast, gdelt_res) -> None:
    fred_r, yahoo_r, pm_r, kalshi_r, news_r, eia_r, cftc_r, rig_r = fast
    payload = signals.build(
        fred_r, yahoo_r, pm_r, kalshi_r, gdelt_res, news_r, eia_r, cftc_r, rig_r,
        _ais_result(),  # read at build time so late-arriving AIS snapshots aren't missed
    )
    cache.put("dashboard", payload)


def _ais_result() -> dict:
    return cache.get_stale("ais_only") or {"status": "pending", "zones": {}}


async def _refresh(force: bool = False) -> None:
    global _refreshing, _last_error
    if _lock.locked():
        return
    async with _lock:
        if not force and cache.get("dashboard", TTL_DEFAULT) is not None:
            return
        _refreshing = True
        try:
            async with httpx.AsyncClient() as client:
                raw = await asyncio.gather(
                    fred.collect(client),
                    yahoo.collect(client),
                    polymarket.collect(client),
                    kalshi.collect(client),
                    news.collect(client),
                    eia.collect(client),
                    cftc.collect(client),
                    rigcount.collect(client),
                    return_exceptions=True,
                )
                names = [
                    "fred", "yahoo", "polymarket", "kalshi",
                    "news", "eia", "cftc", "rigcount",
                ]
                fast = [_norm(r, n) for r, n in zip(raw, names)]
                gdelt_cached = cache.get("gdelt_only", TTL_GDELT)
                stale_gdelt = cache.get_stale("gdelt_only")
                pending = {"status": "pending", "data": {"topics": {}}, "errors": []}
                if gdelt_cached is not None:
                    # Fresh within TTL_GDELT: reuse it even if a topic is
                    # missing — re-collecting on every cycle hammers GDELT's
                    # rate limiter and keeps the missing topic failing.
                    complete = len(gdelt_cached.get("topics", {})) >= len(GDELT_QUERIES)
                    _build_and_cache(fast, {
                        "status": "ok" if complete else "degraded",
                        "data": gdelt_cached,
                        "errors": [],
                    })
                else:
                    backoff = cache.get_stale("gdelt_backoff")
                    in_backoff = backoff and time.time() - backoff.get("at", 0) < GDELT_BACKOFF
                    interim = pending
                    if stale_gdelt and stale_gdelt.get("topics"):
                        interim = {"status": "degraded", "data": stale_gdelt, "errors": []}
                    _build_and_cache(fast, interim)
                    if not in_backoff:
                        gdelt_res = await gdelt.collect(client, previous=stale_gdelt)
                        if gdelt_res.get("status") in ("ok", "degraded"):
                            cache.put("gdelt_only", gdelt_res["data"])
                            _build_and_cache(fast, gdelt_res)
                        else:
                            cache.put("gdelt_backoff", {"at": time.time()})
            _last_error = None
        except Exception as e:
            _last_error = f"{type(e).__name__}: {e}"
        finally:
            _refreshing = False


async def _loop() -> None:
    while True:
        if cache.get("dashboard", TTL_DEFAULT) is None:
            await _refresh()
        await asyncio.sleep(20)


async def _ais_loop() -> None:
    while True:
        try:
            res = await ais.collect(os.environ.get("AISSTREAM_API_KEY"))
            # Store only the data part (status/zones/note live inside it).
            cache.put("ais_only", res["data"])
            if res.get("status") != "no_key" and cache.get("dashboard", TTL_DEFAULT) is not None:
                _spawn(_refresh(force=True))
        except Exception as e:
            cache.put("ais_only", {
                "status": "error",
                "zones": {},
                "note": f"{type(e).__name__}: {e}",
            })
        await asyncio.sleep(AIS_TTL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_loop())
    ais_task = asyncio.create_task(_ais_loop())
    yield
    task.cancel()
    ais_task.cancel()


app = FastAPI(title="Oil Geopolitical Signals", lifespan=lifespan)


@app.get("/api/health")
async def health():
    ts = cache.ts("dashboard")
    return {
        "ok": True,
        "refreshing": _refreshing,
        "last_error": _last_error,
        "cache_age_s": round(time.time() - ts, 1) if ts else None,
    }


@app.get("/api/dashboard")
async def dashboard():
    data = cache.get("dashboard", TTL_DEFAULT)
    if data is None:
        data = cache.get_stale("dashboard")
        _spawn(_refresh())
    if data is None:
        return JSONResponse(
            {"status": "warming_up", "refreshing": _refreshing, "last_error": _last_error},
            status_code=202,
        )
    return data


@app.post("/api/refresh")
async def refresh():
    _spawn(_refresh(force=True))
    return {"started": True, "refreshing": True}


app.mount("/", StaticFiles(directory=str(BASE_DIR / "frontend-mantine" / "dist"), html=True), name="frontend")
