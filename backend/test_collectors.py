import asyncio
import json

import httpx

from collectors import eia, fred, kalshi, news, polymarket, yahoo


async def main():
    async with httpx.AsyncClient() as client:
        for name, mod in [
            ("fred", fred), ("yahoo", yahoo), ("polymarket", polymarket),
            ("kalshi", kalshi), ("news", news), ("eia", eia),
        ]:
            try:
                r = await mod.collect(client)
                data = r.get("data", {})
                preview = json.dumps(data, default=str)[:220]
                print(f"{name:12s} {r['status']:10s} errors={len(r.get('errors', []))} | {preview}")
                for e in r.get("errors", [])[:3]:
                    print(f"{'':12s}   ! {str(e)[:140]}")
            except Exception as e:
                print(f"{name:12s} CRASH {type(e).__name__}: {e}")


asyncio.run(main())
