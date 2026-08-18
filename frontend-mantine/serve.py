"""Production static server for the Mantine frontend.

Serves the built Vite app (dist/) and proxies /api/* to the existing
oilgeo FastAPI backend (the data layer, run with ../run.sh on 127.0.0.1:8787).

Run (after `npm run build`), using the oilgeo conda env:

    /opt/anaconda/envs/oilgeo/bin/python serve.py   # http://127.0.0.1:8788

The legacy app (backend/app.py + frontend/) is left untouched.
"""

import asyncio
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

DIST = Path(__file__).resolve().parent / "dist"
API_TARGET = "http://127.0.0.1:8787"

app = FastAPI(title="Oil Geo Dashboard (Mantine frontend)")


@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{API_TARGET}/api/health")
            return r.json()
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "backend_error": str(e)}, status_code=502)


@app.api_route("/api/{path:path}", methods=["GET", "POST"])
async def proxy_api(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.request(
                request.method,
                f"{API_TARGET}/api/{path}",
                params=request.query_params,
                headers=headers,
                content=body or None,
            )
        return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type"))
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "backend_error": str(e)}, status_code=502)


if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="dist")
else:
    @app.get("/")
    async def no_build():
        return JSONResponse(
            {"error": "dist/ not found — run `npm install && npm run build` first"},
            status_code=500,
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8788)