// Data types mirroring the payload produced by backend/signals.py build().

export interface HistoryPoint {
  date?: string;
  period?: string;
  value: number;
}

export interface Series {
  last?: number;
  change_1d?: number;
  z30?: number;
  history?: HistoryPoint[];
  date?: string;
}

export interface Quote {
  price?: number;
  history?: HistoryPoint[];
}

export interface CurvePoint {
  contract: string;
  symbol: string;
  price: number;
}

export interface CurveState {
  regime: string;
  depth_pct: number;
  front_contract: string;
  back_contract: string;
  front_price: number;
  back_price: number;
  n_contracts: number;
}

export interface PMarket {
  question: string;
  prob: number;
  volume: number;
}

export interface PMEvent {
  id: string;
  title: string;
  category: string;
  volume: number;
  liquidity: number;
  end?: string;
  url: string;
  markets: PMarket[];
}

export interface KalshiLadderPoint {
  ticker: string;
  title: string;
  strike: number;
  date: string;
  prob: number;
  volume: number;
}

export interface KalshiGeoEvent {
  title: string;
  ticker: string;
  markets: { title: string; prob: number; volume: number }[];
}

export interface Chokepoint {
  id: string;
  name: string;
  score: number;
  band: string;
  mentions_7d_sample: number;
  tone: number;
  news_hits: number;
  polymarket?: {
    title: string;
    volume: number;
    markets: PMarket[];
    url: string;
  };
  top_headlines: { title: string; source?: string }[];
  parts: Record<string, number>;
}

export interface Tier3Signal {
  id: string;
  name: string;
  desc: string;
  mentions_7d_sample: number;
  tone: number;
  news_hits: number;
  heat: number;
  band: string;
  top_headlines: { title: string; source?: string }[];
  rss_headlines: { title: string; source: string; ts: string }[];
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  ts: string;
  tags: string[];
  sentiment: number;
}

export interface CotData {
  market: string;
  as_of: string;
  net: number;
  change_wow: number;
  long: number;
  short: number;
  oi: number;
  net_pct_oi: number;
  percentile_26w: number;
  history: { date: string; net: number }[];
}

export interface RigCount {
  as_of: string;
  us_total: number;
  us_total_wow: number;
  us_total_yoy: number;
  us_oil: number;
  us_oil_wow: number;
  us_oil_yoy: number;
  us_gas: number;
  us_gas_wow: number;
  us_gas_yoy: number;
}

export interface SprData {
  unit: string;
  as_of: string;
  last_mb: number;
  change_wow_mb: number;
  change_52w_mb: number;
  history: HistoryPoint[];
}

export interface AisVessel {
  mmsi: number | string;
  name?: string | null;
  lat: number;
  lon: number;
  sog?: number | null;
  cog?: number | null;
  nav_status?: string;
}

export interface AisZone {
  name: string;
  bbox: [number, number][];
  center?: [number, number];
  zoom?: number;
  count: number;
  n_moving?: number;
  n_anchored?: number;
  avg_sog?: number | null;
  vessels: AisVessel[];
}

export interface AisData {
  status?: string;
  provider_status?: string;
  stale?: boolean;
  as_of?: string | null;
  last_attempt_at?: string | null;
  last_success_at?: string | null;
  window_s?: number;
  zones: Record<string, AisZone>;
  note?: string;
}

export interface DashboardData {
  updated: string;
  sources: Record<string, string>;
  risk: {
    composite: number;
    band: string;
    components: Record<string, number>;
    weights: Record<string, number>;
  };
  prices: {
    wti: { live?: number; spot_eia?: number; date?: string; history?: HistoryPoint[] };
    brent: { live?: number; spot_eia?: number; date?: string };
    gold?: number;
    curve: CurvePoint[];
    curve_state?: CurveState;
  };
  chokepoints: Chokepoint[];
  conflict: {
    score: number;
    band: string;
    p_us_invades_iran?: number;
    p_ceasefire_holds?: number;
    iran_news_tone?: number;
    parts: Record<string, number>;
  };
  prediction_markets: {
    polymarket: PMEvent[];
    kalshi_ladder?: { date: string; points: KalshiLadderPoint[] };
    kalshi_geo: KalshiGeoEvent[];
  };
  pm_price: {
    score: number;
    band: string;
    p_wti_hits_95?: number;
    p_wti_hits_105?: number;
    kalshi_atm_strike?: number;
    event?: string;
  };
  macro: {
    yields: Record<string, Series>;
    spread_2s10s?: number;
    dxy?: Series;
    vix?: Series;
    score_detail: { score: number; band: string; spread_2s10s?: number; parts: Record<string, number> };
  };
  macro_ext: {
    ovx?: Series;
    bei5?: Series;
    bei10?: Series;
    copper?: Quote;
    uso?: Quote;
    usdcad?: Quote;
    usdnok?: Quote;
    rbof?: Quote;
    heating_oil?: Quote;
    crack_spread_321?: number;
    brent_wti_spread?: number;
  };
  positioning: {
    cot?: CotData;
    rig_count?: RigCount;
  };
  supply: {
    spr?: SprData;
    inventories?: { status: string; last?: number; change_wow?: number; note?: string };
    curve_state?: CurveState;
  };
  tier3_signals: Tier3Signal[];
  news: NewsItem[];
  gdelt: Record<string, unknown>;
  eia: Record<string, unknown>;
  ais: AisData;
}
