import asyncio
import calendar
import datetime as dt
import hashlib
import re
import time

import feedparser
import httpx

from config import (
    GOOGLE_NEWS_QUERIES,
    NEWS_MAX_ITEMS,
    NEWS_RSS,
    NEWS_WINDOW_HOURS,
    NEG_WORDS,
    POS_WORDS,
)

TAG_RX = {
    "hormuz": re.compile(r"hormuz", re.I),
    "red-sea": re.compile(r"red sea|houthi|bab el-mandeb", re.I),
    "iran": re.compile(r"\biran|israel|hezbollah", re.I),
    "opec": re.compile(r"opec", re.I),
    "oil": re.compile(r"\boil\b|crude|brent|wti|petroleum|tanker", re.I),
    "russia": re.compile(r"russia|ukraine", re.I),
    "venezuela": re.compile(r"venezuela", re.I),
    "treasury": re.compile(r"treasury|fed\b|rates?|yield", re.I),
    "war-risk": re.compile(r"war risk|war-risk|insurance premium", re.I),
    "spr": re.compile(r"\bspr\b|strategic petroleum reserve", re.I),
    "floating": re.compile(r"floating storage|oil on water", re.I),
    "china": re.compile(r"\bchina|beijing", re.I),
    "hurricane": re.compile(r"hurricane|tropical storm", re.I),
}


def _score(title: str) -> int:
    words = set(w.strip(".,;:!?\"'()[]") for w in title.lower().split())
    return len(words & NEG_WORDS) - len(words & POS_WORDS)


def _tags(title: str) -> list[str]:
    return [t for t, rx in TAG_RX.items() if rx.search(title)]


async def _fetch(client: httpx.AsyncClient, url: str) -> bytes:
    r = await client.get(url, timeout=20, follow_redirects=True)
    r.raise_for_status()
    return r.content


def _parse(raw: bytes, source: str) -> list[dict]:
    items = []
    for e in feedparser.parse(raw).entries:
        ts = None
        if hasattr(e, "published_parsed") and e.published_parsed:
            ts = calendar.timegm(e.published_parsed)
        elif hasattr(e, "updated_parsed") and e.updated_parsed:
            ts = calendar.timegm(e.updated_parsed)
        title = re.sub(r"\s+-\s+\S+$", "", e.get("title", "")).strip()
        if not title:
            continue
        items.append({
            "title": title,
            "url": e.get("link", ""),
            "source": source,
            "ts": dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).strftime("%Y-%m-%d %H:%M") if ts else "",
            "_epoch": ts or 0,
        })
    return items


async def collect(client: httpx.AsyncClient) -> dict:
    errors = []
    feeds = {f"Google News · {q}": f"https://news.google.com/rss/search?q={q.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en" for q in GOOGLE_NEWS_QUERIES}
    feeds.update(NEWS_RSS)
    all_items: list[dict] = []
    results = await asyncio.gather(*[_fetch(client, u) for u in feeds.values()], return_exceptions=True)
    for (source, _), res in zip(feeds.items(), results):
        if isinstance(res, Exception):
            errors.append(f"{source}: {res}")
            continue
        try:
            all_items.extend(_parse(res, source.split(" · ")[0]))
        except Exception as e:
            errors.append(f"{source} parse: {e}")

    cutoff = time.time() - NEWS_WINDOW_HOURS * 3600
    seen, out = set(), []
    all_items.sort(key=lambda i: i["_epoch"], reverse=True)
    for it in all_items:
        if it["_epoch"] and it["_epoch"] < cutoff:
            continue
        h = hashlib.md5(it["title"].lower().encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        tags = _tags(it["title"])
        it.pop("_epoch", None)
        it["tags"] = tags
        it["sentiment"] = _score(it["title"])
        out.append(it)
        if len(out) >= NEWS_MAX_ITEMS:
            break
    status = "ok" if not errors else ("degraded" if out else "error")
    return {"status": status, "data": {"items": out}, "errors": errors}
