from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

TTL_DEFAULT = 300
TTL_GDELT = 1800
GDELT_MIN_INTERVAL = 6.5

FRED_SERIES = {
    "dgs2": "DGS2",
    "dgs5": "DGS5",
    "dgs10": "DGS10",
    "dgs30": "DGS30",
    "wti_spot": "DCOILWTICO",
    "brent_spot": "DCOILBRENTEU",
    "dxy": "DTWEXBGS",
    "vix": "VIXCLS",
    "ovx": "OVXCLS",
    "bei5": "T5YIE",
    "bei10": "T10YIE",
}

YAHOO_CURVE_MONTHS = 14
YAHOO_KEEP_MONTHS = 12

YAHOO_EXTRAS = {
    "rbof": "RB=F",
    "heating_oil": "HO=F",
    "copper": "HG=F",
    "uso": "USO",
    "usdcad": "CAD=X",
    "usdnok": "NOK=X",
}

GALLONS_PER_BBL = 42

CHOKEPOINTS = {
    "hormuz": {
        "name": "Strait of Hormuz",
        "gdelt_key": "hormuz",
        "gdelt_query": '("strait of hormuz" OR hormuz)',
        "news_queries": ["strait of hormuz", "hormuz tanker"],
        "pm_keywords": ["hormuz"],
    },
    "bab-mandeb": {
        "name": "Bab el-Mandeb / Red Sea",
        "gdelt_key": "redsea",
        "gdelt_query": '("bab el-mandeb" OR houthi red sea shipping)',
        "news_queries": ["houthi red sea shipping", "bab el-mandeb"],
        "pm_keywords": ["red sea", "houthi", "bab el-mandeb"],
    },
}

PM_SEARCH_QUERIES = [
    "oil", "wti", "hormuz", "iran", "houthi", "opec",
    "venezuela", "russia oil", "red sea", "israel iran",
]
PM_MAX_EVENTS = 14

KALSHI_OIL_SERIES = ["KXWTI", "KXOIL"]
KALSHI_GEO_REGEX = (
    r"iran|hormuz|houthi|oil|opec|venezuela|russia|saudi|israel|"
    r"strait|tanker|petroleum|middle east|crude"
)
KALSHI_MAX_EVENT_PAGES = 3

GDELT_QUERIES = {
    "hormuz": '("strait of hormuz" OR hormuz)',
    "redsea": 'houthi "red sea" shipping',
    "iran": 'iran israel oil',
    "opec": 'opec oil production',
    "warrisk": '"war risk" tanker insurance premium',
    "floatstor": '"floating storage" crude oil',
    "china": 'china crude oil imports',
    "opecspare": 'OPEC "spare capacity"',
    "hurricane": 'hurricane "gulf of mexico" oil production',
}

TIER3_SIGNALS = {
    "warrisk": {
        "name": "Tanker War-Risk Premiums",
        "desc": "Insurance cost to transit conflict zones — the most direct real-time chokepoint stress gauge.",
    },
    "floatstor": {
        "name": "Floating Storage / Oil on Water",
        "desc": "Crude stored on tankers — rises with sanctions friction, congestion, or demand weakness.",
    },
    "china": {
        "name": "China Crude Imports",
        "desc": "World's largest importer; Beijing's buying pace is the biggest demand-side swing factor.",
    },
    "opecspare": {
        "name": "OPEC+ Spare Capacity",
        "desc": "The buffer that absorbs supply shocks — thin spare capacity amplifies geopolitical spikes.",
    },
    "hurricane": {
        "name": "Gulf of Mexico Weather Risk",
        "desc": "Storms can shut in ~15% of US crude output and knock out Gulf Coast refining (Jun–Nov).",
    },
}

NEWS_RSS = {
    "Al Jazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    "BBC Middle East": "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
}
GOOGLE_NEWS_QUERIES = [
    "strait of hormuz",
    "houthi red sea shipping",
    "iran oil",
    "OPEC oil production",
    "oil geopolitics",
]
NEWS_MAX_ITEMS = 60
NEWS_WINDOW_HOURS = 72

RISK_WEIGHTS = {
    "chokepoint": 0.30,
    "conflict": 0.25,
    "curve": 0.15,
    "pm_price": 0.15,
    "macro": 0.10,
    "news_temp": 0.05,
}

RISK_BANDS = [
    (25, "Low"),
    (45, "Elevated"),
    (65, "High"),
    (85, "Severe"),
    (101, "Critical"),
]

NEG_WORDS = {
    "attack", "attacks", "strike", "strikes", "struck", "war", "escalation",
    "escalates", "bomb", "bombs", "missile", "missiles", "drone", "drones",
    "blockade", "closure", "closed", "seized", "seize", "threat", "threatens",
    "tension", "tensions", "conflict", "sanctions", "embargo", "explosion",
    "blast", "sunk", "hit", "hits", "kill", "kills", "killed", "retaliation",
    "retaliates", "invasion", "invade", "disruption", "disrupted", "warning",
    "crisis", "blames", "accuses", "fighting", "offensive", "nuclear",
}
POS_WORDS = {
    "ceasefire", "peace", "deal", "agreement", "talks", "negotiation",
    "negotiations", "de-escalation", "deescalation", "calm", "eases",
    "easing", "resumes", "resume", "reopening", "reopens", "normal",
    "stabilizes", "stabilise", "agrees", "accord", "truce", "diplomacy",
}

EIA_V1_STOCKS_SERIES = "PET.WCESTUP.W"
