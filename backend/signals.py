import datetime as dt
import re

from config import CHOKEPOINTS, GALLONS_PER_BBL, RISK_BANDS, RISK_WEIGHTS, TIER3_SIGNALS

HIGH_RX = re.compile(r"\(HIGH\)\s*\$(\d+)", re.I)


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _gdelt_topic(gdelt_data: dict, key: str) -> dict:
    return (gdelt_data.get("topics") or {}).get(key) or {}


def _chokepoint_score(cp_id: str, gdelt_data: dict, news_data: dict, pm_data: dict) -> dict:
    gkey = CHOKEPOINTS[cp_id].get("gdelt_key", cp_id)
    topic = _gdelt_topic(gdelt_data, gkey)
    mentions = topic.get("mentions_7d_sample") or 0
    tone = topic.get("tone") or 0.0
    cp = CHOKEPOINTS[cp_id]
    wanted = {"hormuz"} if cp_id == "hormuz" else {"red-sea"}
    news_hits = [
        i for i in news_data.get("items", [])
        if wanted & set(i.get("tags", []))
    ]
    pm = (pm_data.get("chokepoint_probs") or {}).get(cp_id)
    pm_disruption = None
    if pm and pm.get("markets"):
        lead = pm["markets"][0]
        pm_disruption = clamp(100 - lead["prob"])
    mention_pts = min(mentions / 60, 1.0) * 40
    tone_pts = clamp(-tone * 40, 0, 30)
    news_pts = min(len(news_hits) / 10, 1.0) * 10
    pm_pts = (pm_disruption or 0) * 0.20
    total = clamp(mention_pts + tone_pts + news_pts + pm_pts)
    return {
        "score": round(total, 1),
        "band": band_for(total),
        "mentions_7d_sample": mentions,
        "tone": tone,
        "news_hits": len(news_hits),
        "polymarket": pm,
        "top_headlines": topic.get("top", [])[:5],
        "parts": {
            "mentions": round(mention_pts, 1),
            "tone": round(tone_pts, 1),
            "news": round(news_pts, 1),
            "polymarket": round(pm_pts, 1),
        },
    }


def _conflict_score(pm_data: dict, gdelt_data: dict) -> dict:
    invade = ceasefire = None
    for e in pm_data.get("events", []):
        t = (e.get("title") or "").lower()
        for m in e.get("markets", []):
            q = (m.get("question") or "").lower()
            if "invade iran" in t or "invade iran" in q:
                invade = m["prob"]
            if "ceasefire" in t and ("continues" in q or "through" in q or "effective" in t):
                if ceasefire is None or m["volume"] > ceasefire[1]:
                    ceasefire = (m["prob"], m["volume"])
    iran = _gdelt_topic(gdelt_data, "iran")
    invade_pts = (invade or 0) * 0.45
    cf_pts = clamp(100 - ceasefire[0], 0, 100) * 0.30 if ceasefire else 15.0
    tone_pts = clamp(-(iran.get("tone") or 0.0) * 40, 0, 25)
    total = clamp(invade_pts + cf_pts + tone_pts)
    return {
        "score": round(total, 1),
        "band": band_for(total),
        "p_us_invades_iran": invade,
        "p_ceasefire_holds": ceasefire[0] if ceasefire else None,
        "iran_news_tone": iran.get("tone"),
        "parts": {"invasion": round(invade_pts, 1), "ceasefire": round(cf_pts, 1), "tone": round(tone_pts, 1)},
    }


def _curve_score(yahoo_data: dict) -> dict:
    cs = yahoo_data.get("curve_state")
    if not cs:
        return {"score": 0.0, "band": "Low", "note": "curve unavailable"}
    depth = cs["depth_pct"]
    score = clamp(depth * 8) if cs["regime"] == "backwardation" else clamp(10 + depth * 0.5, 0, 25)
    return {"score": round(score, 1), "band": band_for(score), "state": cs}


def _is_active(e: dict) -> bool:
    end = e.get("end") or ""
    if not end:
        return True
    try:
        return dt.datetime.strptime(end, "%Y-%m-%d").date() >= dt.datetime.now(dt.timezone.utc).date()
    except ValueError:
        return True


def _pm_price_score(pm_data: dict, kalshi_data: dict) -> dict:
    p95 = p105 = None
    best_event = None
    for e in pm_data.get("events", []):
        if e.get("category") != "oil-price" or not _is_active(e):
            continue
        highs = {}
        for m in e.get("markets", []):
            hm = HIGH_RX.search(m.get("question") or "")
            if hm:
                strike = int(hm.group(1))
                highs[strike] = max(highs.get(strike, 0.0), m["prob"])
        if highs and (best_event is None or e["volume"] > best_event["volume"]):
            best_event = e
            p95 = highs.get(95)
            p105 = highs.get(105)
    ladder = kalshi_data.get("wti_ladder") or {}
    ladder_atm = None
    pts = [p for p in ladder.get("points", []) if p.get("prob") is not None]
    if pts:
        mid_strike = sorted(pts, key=lambda p: abs(p["prob"] - 50))[0]
        ladder_atm = mid_strike["strike"]
    score = clamp(((p95 or 0) + 0.5 * (p105 or 0)) * 1.2)
    return {
        "score": round(score, 1),
        "band": band_for(score),
        "p_wti_hits_95": p95,
        "p_wti_hits_105": p105,
        "kalshi_atm_strike": ladder_atm,
        "event": best_event["title"] if best_event else None,
    }


def _macro_score(fred_data: dict) -> dict:
    vix = fred_data.get("vix") or {}
    ovx = fred_data.get("ovx") or {}
    dxy = fred_data.get("dxy") or {}
    d10 = fred_data.get("dgs10") or {}
    d2 = fred_data.get("dgs2") or {}
    vix_pts = clamp((vix.get("z30", 0) or 0) * 14, 0, 28) + clamp((vix.get("change_1d", 0) or 0) * 2.0, 0, 12)
    ovx_pts = clamp((ovx.get("z30", 0) or 0) * 12, 0, 30) + clamp((ovx.get("change_1d", 0) or 0) * 1.5, 0, 15)
    dxy_pct = (dxy.get("change_1d", 0) or 0) / (dxy.get("last") or 1) * 100
    dxy_pts = clamp(dxy_pct * 40, 0, 10)
    rates_pts = clamp(abs(d10.get("change_1d", 0) or 0) * 25, 0, 5)
    total = clamp(vix_pts + ovx_pts + dxy_pts + rates_pts)
    spread = None
    if d10.get("last") is not None and d2.get("last") is not None:
        spread = round(d10["last"] - d2["last"], 3)
    return {
        "score": round(total, 1),
        "band": band_for(total),
        "spread_2s10s": spread,
        "parts": {
            "vix": round(vix_pts, 1),
            "ovx": round(ovx_pts, 1),
            "dxy": round(dxy_pts, 1),
            "rates": round(rates_pts, 1),
        },
    }


def _macro_ext(fred_data: dict, yahoo_data: dict, wti_live) -> dict:
    extras = yahoo_data.get("extras", {})
    quotes = yahoo_data.get("quotes", {})

    def _px(name):
        return (extras.get(name) or {}).get("price")

    crack = None
    rb, ho = _px("rbof"), _px("heating_oil")
    if rb and ho and wti_live:
        crack = round((2 * rb * GALLONS_PER_BBL + ho * GALLONS_PER_BBL - 3 * wti_live) / 3, 2)
    brent_live = (quotes.get("brent_front") or {}).get("price")
    bw_spread = round(brent_live - wti_live, 2) if (brent_live and wti_live) else None
    return {
        "ovx": fred_data.get("ovx") or {},
        "bei5": fred_data.get("bei5") or {},
        "bei10": fred_data.get("bei10") or {},
        "copper": extras.get("copper") or {},
        "uso": extras.get("uso") or {},
        "usdcad": extras.get("usdcad") or {},
        "usdnok": extras.get("usdnok") or {},
        "rbof": extras.get("rbof") or {},
        "heating_oil": extras.get("heating_oil") or {},
        "crack_spread_321": crack,
        "brent_wti_spread": bw_spread,
    }


def _tier3_cards(gdelt_data: dict, news_data: dict) -> list:
    topics = gdelt_data.get("topics") or {}
    items = news_data.get("items", [])
    tag_map = {
        "warrisk": ["war-risk"],
        "floatstor": ["floating"],
        "china": ["china"],
        "opecspare": ["opec"],
        "hurricane": ["hurricane"],
    }
    cards = []
    for key, meta in TIER3_SIGNALS.items():
        topic = topics.get(key) or {}
        tags = tag_map.get(key, [])
        hits = [i for i in items if set(i.get("tags", [])) & set(tags)]
        mentions = topic.get("mentions_7d_sample") or 0
        tone = topic.get("tone") or 0.0
        heat = clamp(min(mentions / 60, 1.0) * 55 + min(len(hits) / 8, 1.0) * 25 + clamp(-tone * 30, 0, 20))
        cards.append({
            "id": key,
            "name": meta["name"],
            "desc": meta["desc"],
            "mentions_7d_sample": mentions,
            "tone": tone,
            "news_hits": len(hits),
            "heat": round(heat, 1),
            "band": band_for(heat),
            "top_headlines": topic.get("top", [])[:4],
            "rss_headlines": [
                {"title": h.get("title", ""), "source": h.get("source", ""), "ts": h.get("ts", "")}
                for h in hits[:4]
            ],
        })
    return cards


def _news_temp_score(news_data: dict) -> dict:
    items = news_data.get("items", [])
    geo = [i for i in items if set(i.get("tags", [])) & {"hormuz", "red-sea", "iran", "opec", "oil", "russia", "venezuela"}]
    neg = [i for i in geo if i.get("sentiment", 0) < 0]
    vol_pts = min(len(geo) / 40, 1.0) * 60
    neg_pts = (len(neg) / len(geo)) * 40 if geo else 0
    total = clamp(vol_pts + neg_pts)
    return {"score": round(total, 1), "band": band_for(total), "headlines_72h": len(geo), "negative_share": round(len(neg) / len(geo), 2) if geo else 0}


def band_for(score: float) -> str:
    for limit, name in RISK_BANDS:
        if score < limit:
            return name
    return "Critical"


def build(fred, yahoo, pm, kalshi, gdelt, news, eia, cftc=None, rigcount=None, ais=None) -> dict:
    fred_d, yahoo_d = fred.get("data", {}), yahoo.get("data", {})
    pm_d, kalshi_d = pm.get("data", {}), kalshi.get("data", {})
    gdelt_d, news_d, eia_d = gdelt.get("data", {}), news.get("data", {}), eia.get("data", {})
    cftc_d = (cftc or {}).get("data", {})
    rig_d = (rigcount or {}).get("data", {})
    ais_d = ais or {"status": "unavailable", "zones": {}}

    chokepoints = []
    for cp_id, cp in CHOKEPOINTS.items():
        c = _chokepoint_score(cp_id, gdelt_d, news_d, pm_d)
        chokepoints.append({"id": cp_id, "name": cp["name"], **c})
    choke_comp = max((c["score"] for c in chokepoints), default=0.0)

    conflict = _conflict_score(pm_d, gdelt_d)
    curve = _curve_score(yahoo_d)
    pm_price = _pm_price_score(pm_d, kalshi_d)
    macro = _macro_score(fred_d)
    news_temp = _news_temp_score(news_d)

    composite = clamp(
        RISK_WEIGHTS["chokepoint"] * choke_comp
        + RISK_WEIGHTS["conflict"] * conflict["score"]
        + RISK_WEIGHTS["curve"] * curve["score"]
        + RISK_WEIGHTS["pm_price"] * pm_price["score"]
        + RISK_WEIGHTS["macro"] * macro["score"]
        + RISK_WEIGHTS["news_temp"] * news_temp["score"]
    )

    wti = fred_d.get("wti_spot") or {}
    brent = fred_d.get("brent_spot") or {}
    quotes = yahoo_d.get("quotes", {})
    if quotes.get("wti_front"):
        wti_live = quotes["wti_front"]["price"]
    else:
        wti_live = wti.get("last")

    macro_ext = _macro_ext(fred_d, yahoo_d, wti_live)
    tier3 = _tier3_cards(gdelt_d, news_d)

    return {
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sources": {
            k: v.get("status")
            for k, v in {
                "fred": fred, "yahoo": yahoo, "polymarket": pm,
                "kalshi": kalshi, "gdelt": gdelt, "news": news, "eia": eia,
                "cftc": cftc or {"status": "error"},
                "rigcount": rigcount or {"status": "error"},
                "ais": ais_d,
            }.items()
        },
        "risk": {
            "composite": round(composite, 1),
            "band": band_for(composite),
            "components": {
                "chokepoint": round(choke_comp, 1),
                "conflict": conflict["score"],
                "curve": curve["score"],
                "pm_price": pm_price["score"],
                "macro": macro["score"],
                "news_temp": news_temp["score"],
            },
            "weights": RISK_WEIGHTS,
        },
        "prices": {
            "wti": {"live": wti_live, "spot_eia": wti.get("last"), "date": wti.get("date"), "history": (quotes.get("wti_front") or {}).get("history", [])},
            "brent": {"live": (quotes.get("brent_front") or {}).get("price"), "spot_eia": brent.get("last"), "date": brent.get("date")},
            "gold": (quotes.get("gold") or {}).get("price"),
            "curve": yahoo_d.get("curve", []),
            "curve_state": yahoo_d.get("curve_state"),
        },
        "chokepoints": chokepoints,
        "conflict": conflict,
        "prediction_markets": {
            "polymarket": pm_d.get("events", []),
            "kalshi_ladder": kalshi_d.get("wti_ladder"),
            "kalshi_geo": kalshi_d.get("geo_events", []),
        },
        "pm_price": pm_price,
        "macro": {
            "yields": {k: fred_d.get(k) for k in ("dgs2", "dgs5", "dgs10", "dgs30")},
            "spread_2s10s": macro["spread_2s10s"],
            "dxy": fred_d.get("dxy"),
            "vix": fred_d.get("vix"),
            "score_detail": macro,
        },
        "macro_ext": macro_ext,
        "positioning": {
            "cot": cftc_d or None,
            "rig_count": rig_d or None,
        },
        "supply": {
            "spr": eia_d.get("spr"),
            "inventories": eia_d.get("inventories"),
            "curve_state": yahoo_d.get("curve_state"),
        },
        "tier3_signals": tier3,
        "news": news_d.get("items", []),
        "gdelt": gdelt_d,
        "eia": {"status": eia.get("status"), **eia_d},
        "ais": ais_d,
    }
