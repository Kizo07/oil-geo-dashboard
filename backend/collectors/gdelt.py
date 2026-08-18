import asyncio
import datetime as dt

import httpx

from config import GDELT_MIN_INTERVAL, GDELT_QUERIES, NEG_WORDS, POS_WORDS

DOC = "https://api.gdeltproject.org/api/v2/doc/doc"


def lexicon_score(text: str) -> int:
    words = set(w.strip(".,;:!?\"'()[]") for w in text.lower().split())
    return len(words & NEG_WORDS) - len(words & POS_WORDS)


async def _query(client: httpx.AsyncClient, q: str) -> dict:
    arts = None
    for attempt in range(2):
        r = await client.get(
            DOC,
            params={
                "query": q,
                "mode": "artlist",
                "maxrecords": 60,
                "timespan": "7d",
                "format": "json",
                "sort": "DateDesc",
            },
            timeout=30,
        )
        body = r.text.strip()
        if r.status_code == 429 or body.startswith("<") or "limit requests" in body.lower():
            await asyncio.sleep(8 * (attempt + 1))
            continue
        r.raise_for_status()
        arts = r.json().get("articles", [])
        break
    if arts is None:
        raise RuntimeError("GDELT rate-limited after retries")
    scores = [lexicon_score(a.get("title", "")) for a in arts]
    tone = round(sum(scores) / len(scores), 3) if scores else 0.0
    return {
        "query": q,
        "mentions_7d_sample": len(arts),
        "tone": tone,
        "top": [
            {
                "title": a.get("title"),
                "source": a.get("domain"),
                "url": a.get("url"),
                "date": a.get("seendate", "")[:8],
                "score": lexicon_score(a.get("title", "")),
            }
            for a in arts[:8]
        ],
    }


async def collect(client: httpx.AsyncClient, previous: dict | None = None) -> dict:
    out, errors = {}, []
    prev_topics = (previous or {}).get("topics", {})
    for key, q in GDELT_QUERIES.items():
        try:
            out[key] = await _query(client, q)
        except Exception as e:
            errors.append(f"{key}: {e}")
            if key in prev_topics:
                out[key] = prev_topics[key]
        await asyncio.sleep(GDELT_MIN_INTERVAL)
    status = "ok" if not errors else ("degraded" if out else "error")
    return {
        "status": status,
        "data": {"as_of": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"), "topics": out},
        "errors": errors,
    }
