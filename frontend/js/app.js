const $ = (id) => document.getElementById(id);
const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? "—" : Number(v).toFixed(d);
const fmtInt = (v) => (v === null || v === undefined || isNaN(v)) ? "—" : Math.round(v).toLocaleString();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chgCls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");
const chgArrow = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "•");

let charts = {};
let DATA = null;
let NEWS_FILTER = null;

function chart(id) {
  if (!window.echarts) return null;
  const el = $(id);
  if (!el) return null;
  if (charts[id] && charts[id].getDom() !== el) {
    charts[id].dispose();
    delete charts[id];
  }
  if (!charts[id]) charts[id] = echarts.init(el);
  return charts[id];
}

function axisStyle() {
  return {
    axisLine: { lineStyle: { color: "#2a3245" } },
    axisLabel: { color: "#8b93a7", fontFamily: "JetBrains Mono", fontSize: 10 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.045)" } },
  };
}

const TOOLTIP = { trigger: "axis", backgroundColor: "#111622", borderColor: "#2a3245", textStyle: { color: "#e8ecf4", fontSize: 11 } };

function lineChart(id, hist, color, opts = {}) {
  const c = chart(id);
  if (!c || !hist || !hist.length) return;
  const dates = hist.map((h) => h.date || h.period || "");
  const vals = hist.map((h) => h.value);
  c.setOption({
    grid: { left: opts.left ?? 40, right: 8, top: 8, bottom: 18 },
    xAxis: { type: "category", show: opts.xAxis !== false ? true : false, data: dates, ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, fontSize: 9 } },
    yAxis: { type: "value", scale: true, ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, fontSize: 9, formatter: opts.yFmt || "{value}" } },
    series: [{
      type: opts.type || "line", data: vals, showSymbol: false, smooth: true,
      lineStyle: { color, width: 1.8 },
      areaStyle: opts.area ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + "44" }, { offset: 1, color: color + "00" }] } } : undefined,
      itemStyle: opts.type === "bar" ? { color, borderRadius: [3, 3, 0, 0] } : undefined,
    }],
    tooltip: TOOLTIP,
  }, true);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  if (history.replaceState) history.replaceState(null, "", "#" + name);
  setTimeout(() => Object.values(charts).forEach((c) => c.resize()), 30);
}

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

const _initialTab = (location.hash || "").replace("#", "");
if (_initialTab && document.getElementById("tab-" + _initialTab)) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === _initialTab));
  document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + _initialTab));
}

/* ================= OVERVIEW ================= */

function renderGauge(risk) {
  const c = chart("gauge");
  if (!c) { $("gauge").innerHTML = `<div style="font-size:42px;font-weight:800;text-align:center;padding-top:50px">${fmt(risk.composite, 1)}</div>`; return; }
  const color = risk.composite >= 65 ? "#ff4d5e" : risk.composite >= 45 ? "#ff9f43" : risk.composite >= 25 ? "#ffd166" : "#2dd4a7";
  c.setOption({
    series: [{
      type: "gauge", startAngle: 210, endAngle: -30, min: 0, max: 100,
      radius: "100%", center: ["50%", "62%"],
      progress: { show: true, width: 16, roundCap: true, itemStyle: { color, shadowBlur: 18, shadowColor: color } },
      axisLine: { lineStyle: { width: 16, color: [[1, "rgba(255,255,255,0.07)"]] } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
      title: { show: true, offsetCenter: [0, "34%"], color: "#8b93a7", fontSize: 12, fontFamily: "Inter" },
      detail: { valueAnimation: true, offsetCenter: [0, "-4%"], fontSize: 40, fontWeight: 800, fontFamily: "JetBrains Mono", color, formatter: (v) => v.toFixed(1) },
      data: [{ value: risk.composite, name: risk.band.toUpperCase() }],
    }],
  }, true);
  $("risk-components").innerHTML = Object.entries(risk.components).map(([k, v]) =>
    `<span class="rc">${k} <b>${fmt(v, 0)}</b><span class="dim"> ×${risk.weights[k]}</span></span>`).join("");
}

function renderPrices(d) {
  const wti = d.prices.wti || {};
  $("wti-price").textContent = fmt(wti.live);
  const cs = d.prices.curve_state;
  $("wti-contract").textContent = cs ? cs.front_contract : "";
  $("brent-price").textContent = fmt(d.prices.brent?.live ?? d.prices.brent?.spot_eia);
  $("gold-price").textContent = d.prices.gold ? fmt(d.prices.gold, 0) : "—";
  const bw = d.macro_ext?.brent_wti_spread;
  $("bw-spread").textContent = bw !== null && bw !== undefined ? `${bw > 0 ? "+" : ""}${fmt(bw)}` : "—";
  lineChart("wti-spark", wti.history || [], "#ffb020", { area: true, xAxis: false, left: 0 });
}

function renderCurveCard(d) {
  const cs = d.prices.curve_state;
  const el = $("curve-regime");
  if (!cs) { el.textContent = "N/A"; el.className = "regime"; return; }
  const back = cs.regime === "backwardation";
  el.textContent = back ? "◣ BACKWARDATION" : "◢ CONTANGO";
  el.className = "regime " + (back ? "back" : "contango");
  $("curve-depth").innerHTML =
    `${back ? "+" : ""}${fmt(cs.depth_pct)}% <span class="dim small">front (${cs.front_contract}) vs ${cs.back_contract} · ${cs.n_contracts} contracts</span>`;
  $("curve-note").textContent = back
    ? "Near-term supply tightness — spot premium over deferred months. Deep backwardation often accompanies acute geopolitical supply risk."
    : "Market well supplied — deferred months trade at a premium (storage economics dominate).";
}

function renderMacroMini(d) {
  const m = d.macro || {};
  const rows = [];
  if (m.spread_2s10s !== null && m.spread_2s10s !== undefined) rows.push(["2s10s spread", `${fmt(m.spread_2s10s, 2)}%`, chgCls(-m.spread_2s10s)]);
  if (m.dxy) rows.push(["Dollar index", fmt(m.dxy.last, 1), chgCls(m.dxy.change_1d)]);
  if (m.vix) rows.push(["VIX", fmt(m.vix.last, 1), chgCls(m.vix.change_1d)]);
  const ovx = d.macro_ext?.ovx;
  if (ovx) rows.push(["OVX (oil vol)", fmt(ovx.last, 1), chgCls(ovx.change_1d)]);
  const cot = d.positioning?.cot;
  if (cot) rows.push(["MM net COT", fmtInt(cot.net), chgCls(cot.change_wow)]);
  $("macro-mini-rows").innerHTML = rows.map(([k, v, cls]) =>
    `<div class="macro-row"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`).join("");
}

function renderCurveChart(d) {
  const curve = d.prices.curve || [];
  const c = chart("curve-chart");
  if (!c || !curve.length) return;
  c.setOption({
    grid: { left: 48, right: 18, top: 26, bottom: 30 },
    tooltip: TOOLTIP,
    xAxis: { type: "category", data: curve.map((p) => p.contract), ...axisStyle() },
    yAxis: { type: "value", scale: true, ...axisStyle() },
    series: [{
      type: "line", data: curve.map((p) => p.price), smooth: true, showSymbol: true,
      symbolSize: 7, lineStyle: { color: "#4cc9f0", width: 2.5 },
      itemStyle: { color: "#4cc9f0", borderColor: "#07090f", borderWidth: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(76,201,240,0.22)" }, { offset: 1, color: "rgba(76,201,240,0)" }] } },
      markLine: { silent: true, symbol: "none", data: [{ yAxis: curve[0].price, label: { formatter: "front", color: "#8b93a7", fontSize: 10 }, lineStyle: { color: "rgba(255,176,32,0.5)", type: "dashed" } }] },
    }],
  }, true);
}

function renderTier3Strip(d) {
  $("tier3-strip").innerHTML = (d.tier3_signals || []).map((t) => `
    <div class="t3-row" title="${esc(t.desc)}">
      <span class="t3-name">${esc(t.name)}</span>
      <div class="t3-bar"><div class="t3-fill" style="width:${t.heat}%"></div></div>
      <span class="t3-val">${fmt(t.heat, 0)}</span>
    </div>`).join("");
}

/* ================= MACRO ================= */

function renderYields(d) {
  const ys = d.macro?.yields || {};
  const cells = [["2Y", ys.dgs2], ["5Y", ys.dgs5], ["10Y", ys.dgs10], ["30Y", ys.dgs30]];
  $("yields-grid").innerHTML = cells.map(([t, y]) => y ? `
    <div class="yield-cell">
      <div class="tenor">UST ${t}</div>
      <div class="yv">${fmt(y.last)}%</div>
      <div class="yc ${chgCls(y.change_1d)}">${chgArrow(y.change_1d)} ${fmt(Math.abs(y.change_1d))} 1d</div>
    </div>` : "").join("");
  const b5 = d.macro_ext?.bei5, b10 = d.macro_ext?.bei10;
  $("bei-row").innerHTML = `
    ${b5 ? `<span class="bei-chip">5y breakeven <b>${fmt(b5.last)}%</b> <span class="${chgCls(b5.change_1d)}">${chgArrow(b5.change_1d)}${fmt(Math.abs(b5.change_1d))}</span></span>` : ""}
    ${b10 ? `<span class="bei-chip">10y breakeven <b>${fmt(b10.last)}%</b> <span class="${chgCls(b10.change_1d)}">${chgArrow(b10.change_1d)}${fmt(Math.abs(b10.change_1d))}</span></span>` : ""}
    <span class="bei-chip">2s10s <b>${fmt(d.macro?.spread_2s10s)}%</b></span>`;
}

function vcard(label, val, change, unit = "", digits = 2) {
  const has = val !== null && val !== undefined;
  return `<div class="vcard">
    <div class="vk">${esc(label)}</div>
    <div class="vv">${has ? fmt(val, digits) + unit : "—"}</div>
    <div class="vc ${has ? chgCls(change) : "flat"}">${has ? `${chgArrow(change)} ${fmt(Math.abs(change ?? 0))} 1d` : ""}</div>
  </div>`;
}

function renderVolCards(d) {
  const v = d.macro?.vix, o = d.macro_ext?.ovx;
  $("vol-cards").innerHTML =
    vcard("VIX", v?.last, v?.change_1d) +
    vcard("OVX oil vol", o?.last, o?.change_1d) +
    vcard("OVX z-30d", o?.z30, null);
  lineChart("mc-ovx", o?.history || [], "#ff9f43", { area: true });
  lineChart("mc-vix", v?.history || [], "#ff4d5e", { area: true });
}

function renderFxCards(d) {
  const dx = d.macro?.dxy, cad = d.macro_ext?.usdcad, nok = d.macro_ext?.usdnok, cu = d.macro_ext?.copper;
  $("fx-cards").innerHTML =
    vcard("Dollar index", dx?.last, dx?.change_1d, "", 1) +
    vcard("USD/CAD", cad?.price, null, "", 4) +
    vcard("USD/NOK", nok?.price, null, "", 3) +
    vcard("Copper $/lb", cu?.price, null, "", 2);
  const wrap = $("fx-charts");
  ["mc-cad", "mc-copper"].forEach((id) => { if (charts[id]) { charts[id].dispose(); delete charts[id]; } });
  wrap.innerHTML = `
    <div><div class="macro-chart-label">USD/CAD · 6w</div><div id="mc-cad" class="macro-chart"></div></div>
    <div><div class="macro-chart-label">Copper · 6w</div><div id="mc-copper" class="macro-chart"></div></div>`;
  lineChart("mc-cad", cad?.history || [], "#4cc9f0");
  lineChart("mc-copper", cu?.history || [], "#ff9f43");
}

function renderCrackPanel(d) {
  const me = d.macro_ext || {};
  const crack = me.crack_spread_321;
  const rb = me.rbof?.price, ho = me.heating_oil?.price;
  const level = crack === null ? "" : crack > 35 ? "very high — product scarcity" : crack > 20 ? "healthy refining margins" : crack > 8 ? "normal" : "weak demand / refining stress";
  $("crack-panel").innerHTML = `
    <div class="big-stat-grid">
      <div class="big-stat"><div class="bv" style="color:${crack > 35 ? "var(--red)" : "var(--amber)"}">${crack !== null ? "$" + fmt(crack) : "—"}</div><div class="bk">3:2:1 crack $/bbl</div><div class="bs dim">${level}</div></div>
      <div class="big-stat"><div class="bv">${rb ? "$" + fmt(rb, 3) : "—"}</div><div class="bk">RBOB gasoline $/gal</div></div>
      <div class="big-stat"><div class="bv">${ho ? "$" + fmt(ho, 3) : "—"}</div><div class="bk">Heating oil $/gal</div></div>
    </div>`;
  lineChart("mc-rb", me.rbof?.history || [], "#2dd4a7");
}

function renderBenchCards(d) {
  const me = d.macro_ext || {};
  const uso = me.uso, wti = d.prices?.wti, gold = d.prices?.gold;
  $("bench-cards").innerHTML =
    vcard("USO ETF", uso?.price, null, "", 2) +
    vcard("WTI front", wti?.live, null, "", 2) +
    vcard("Gold", gold, null, "", 0);
  lineChart("mc-uso", uso?.history || [], "#ffb020");
}

/* ================= POSITIONING ================= */

function renderCot(d) {
  const cot = d.positioning?.cot;
  if (!cot) { $("cot-panel").innerHTML = '<div class="dim small">CFTC data unavailable.</div>'; return; }
  const netCls = cot.net >= 0 ? "down" : "up";
  $("cot-panel").innerHTML = `
    <div class="big-stat-grid">
      <div class="big-stat"><div class="bv ${netCls}">${cot.net >= 0 ? "+" : ""}${fmtInt(cot.net)}</div><div class="bk">Managed money net</div><div class="bs ${chgCls(cot.change_wow)}">${chgArrow(cot.change_wow)} ${fmtInt(Math.abs(cot.change_wow))} w/w</div></div>
      <div class="big-stat"><div class="bv">${fmt(cot.net_pct_oi, 1)}%</div><div class="bk">Net / open interest</div><div class="bs dim">OI ${fmtInt(cot.oi)}</div></div>
      <div class="big-stat"><div class="bv">${fmt(cot.percentile_26w, 0)}%</div><div class="bk">26-week percentile</div><div class="bs dim">as of ${esc(cot.as_of)}</div></div>
    </div>`;
  const c = chart("cot-chart");
  if (!c || !cot.history?.length) return;
  c.setOption({
    grid: { left: 55, right: 12, top: 20, bottom: 28 },
    tooltip: TOOLTIP,
    xAxis: { type: "category", data: cot.history.map((h) => h.date), ...axisStyle() },
    yAxis: { type: "value", scale: true, ...axisStyle() },
    series: [{
      type: "bar", data: cot.history.map((h) => ({
        value: h.net,
        itemStyle: { color: h.net >= 0 ? "rgba(45,212,167,0.8)" : "rgba(255,77,94,0.8)", borderRadius: [3, 3, 0, 0] },
      })),
      markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: "rgba(255,255,255,0.25)" } }] },
    }],
  }, true);
}

function renderRigPanel(d) {
  const r = d.positioning?.rig_count;
  if (!r) { $("rig-panel").innerHTML = '<div class="dim small">Rig count unavailable.</div>'; return; }
  $("rig-panel").innerHTML = `
    <div class="big-stat-grid">
      <div class="big-stat"><div class="bv">${fmtInt(r.us_oil)}</div><div class="bk">US oil rigs</div><div class="bs ${chgCls(r.us_oil_wow)}">${chgArrow(r.us_oil_wow)} ${fmtInt(Math.abs(r.us_oil_wow ?? 0))} w/w · ${r.us_oil_yoy != null ? (r.us_oil_yoy >= 0 ? "+" : "") + fmtInt(r.us_oil_yoy) + " y/y" : ""}</div></div>
      <div class="big-stat"><div class="bv">${fmtInt(r.us_gas)}</div><div class="bk">US gas rigs</div><div class="bs ${chgCls(r.us_gas_wow)}">${chgArrow(r.us_gas_wow)} ${fmtInt(Math.abs(r.us_gas_wow ?? 0))} w/w</div></div>
      <div class="big-stat"><div class="bv">${fmtInt(r.us_total)}</div><div class="bk">US total</div><div class="bs dim">as of ${esc(r.as_of)}</div></div>
    </div>
    <div class="dim small">Rig count is the earliest leading indicator of future US shale supply — sustained moves foreshadow production shifts 6–12 months out.</div>`;
}

function renderKalshi(d) {
  const lad = d.prediction_markets?.kalshi_ladder;
  const c = chart("kalshi-chart");
  if (!c || !lad || !lad.points?.length) { if ($("kalshi-chart")) $("kalshi-chart").innerHTML = '<div class="dim small" style="padding:20px">No open Kalshi WTI ladder found.</div>'; return; }
  $("kalshi-date").textContent = lad.date ? `· expiry ${lad.date}` : "";
  const pts = lad.points;
  c.setOption({
    grid: { left: 44, right: 14, top: 20, bottom: 28 },
    tooltip: { trigger: "axis", backgroundColor: "#111622", borderColor: "#2a3245", textStyle: { color: "#e8ecf4", fontSize: 12 }, formatter: (p) => `strike $${p[0].name}<br/>P(settle &gt; strike): <b>${fmt(p[0].value, 1)}%</b>` },
    xAxis: { type: "category", data: pts.map((p) => p.strike), ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: "${value}" } },
    yAxis: { type: "value", max: 100, ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: "{value}%" } },
    series: [{
      type: "bar", data: pts.map((p) => ({ value: p.prob, itemStyle: { color: p.prob >= 50 ? "rgba(45,212,167,0.85)" : "rgba(255,77,94,0.8)", borderRadius: [3, 3, 0, 0] } })),
      barWidth: "62%",
      markLine: { silent: true, symbol: "none", data: [{ yAxis: 50, label: { formatter: "50%", color: "#8b93a7", fontSize: 10 }, lineStyle: { color: "rgba(255,255,255,0.25)", type: "dashed" } }] },
    }],
  }, true);
}

/* ================= SUPPLY ================= */

function renderSpr(d) {
  const spr = d.supply?.spr;
  if (!spr) { $("spr-panel").innerHTML = '<div class="dim small">SPR data unavailable.</div>'; return; }
  const prior = (spr.history || []).slice(0, -1);
  const pct = prior.length ? Math.round((prior.filter((h) => h.value <= spr.last_mb).length / prior.length) * 100) : null;
  $("spr-panel").innerHTML = `
    <div class="big-stat-grid">
      <div class="big-stat"><div class="bv" style="color:${spr.change_wow_mb < 0 ? "var(--red)" : "var(--green)"}">${fmt(spr.last_mb, 1)}<span style="font-size:13px"> Mb</span></div><div class="bk">SPR crude stocks</div><div class="bs ${chgCls(spr.change_wow_mb)}">${chgArrow(spr.change_wow_mb)} ${fmt(Math.abs(spr.change_wow_mb))} Mb w/w</div></div>
      <div class="big-stat"><div class="bv ${spr.change_52w_mb < 0 ? "up" : "down"}">${spr.change_52w_mb > 0 ? "+" : ""}${fmt(spr.change_52w_mb, 1)}</div><div class="bk">52-week change Mb</div></div>
      <div class="big-stat"><div class="bv">${pct !== null ? pct + "%" : "—"}</div><div class="bk">52w percentile</div><div class="bs dim">as of ${esc(spr.as_of)}</div></div>
    </div>`;
  lineChart("spr-chart", spr.history || [], "#a78bfa", { area: true, yFmt: "{value}" });
}

function renderInvPanel(d) {
  const inv = d.supply?.inventories;
  const cs = d.supply?.curve_state;
  let html = "";
  if (inv && inv.status === "ok") {
    html += `<div class="macro-rows">
      <div class="macro-row"><span class="k">EIA commercial crude stocks</span><span class="v">${fmtInt(inv.last)} k bbl</span></div>
      <div class="macro-row"><span class="k">Week-on-week change</span><span class="v ${chgCls(-inv.change_wow)}">${inv.change_wow > 0 ? "+" : ""}${fmt(inv.change_wow, 1)} k bbl</span></div>
    </div>`;
  } else {
    html += `<div class="dim small" style="margin-bottom:10px">${esc(inv?.note || "Commercial inventory data requires a free EIA_API_KEY — set it and restart the server.")}</div>`;
  }
  if (cs) {
    html += `<div class="macro-rows">
      <div class="macro-row"><span class="k">Curve regime</span><span class="v ${cs.regime === "backwardation" ? "up" : "down"}">${cs.regime.toUpperCase()}</span></div>
      <div class="macro-row"><span class="k">Front vs back spread</span><span class="v">${cs.depth_pct > 0 ? "+" : ""}${fmt(cs.depth_pct)}%</span></div>
    </div>
    <div class="dim small" style="margin-top:8px">Deep backwardation = acute physical tightness; contango = ample supply / storage economics dominate.</div>`;
  }
  $("inv-panel").innerHTML = html;
}

function t3Card(t) {
  return `<div class="t3-card">
    <div class="t3-head">
      <span class="t3-title">${esc(t.name)}</span>
      <span class="band ${t.band}">${fmt(t.heat, 0)} · ${t.band}</span>
    </div>
    <div class="t3-desc">${esc(t.desc)}</div>
    <div class="t3-meta">
      <span>GDELT 7d: ${fmtInt(t.mentions_7d_sample)}${t.mentions_7d_sample >= 60 ? "+" : ""}</span>
      <span>tone: ${fmt(t.tone, 2)}</span>
      <span>RSS 72h: ${fmtInt(t.news_hits)}</span>
    </div>
    <div class="mini-headlines" style="margin-top:7px">
      ${(t.top_headlines || []).slice(0, 3).map((h) => `<div class="mini-hl">${esc(h.title)} <span class="news-src">${esc(h.source || "")}</span></div>`).join("")}
      ${(t.rss_headlines || []).slice(0, 2).map((h) => `<div class="mini-hl">${esc(h.title)} <span class="news-src">${esc(h.source || "")}</span></div>`).join("")}
    </div>
  </div>`;
}

function renderSupplyTier3(d) {
  const ids = ["floatstor", "opecspare", "china"];
  const cards = (d.tier3_signals || []).filter((t) => ids.includes(t.id));
  $("supply-tier3").innerHTML = cards.map(t3Card).join("");
}

/* ================= GEOPOLITICS ================= */

function renderChokepoints(d) {
  $("chokepoint-cards").innerHTML = (d.chokepoints || []).map((cp) => {
    const pm = cp.polymarket;
    const pmHtml = pm ? `
      <div class="mini-headlines" style="margin-top:10px">
        <div class="card-label" style="margin-bottom:6px">Polymarket · ${esc(pm.title)} <span class="dim small">($${fmtInt(pm.volume)} vol)</span></div>
        ${pm.markets.slice(0, 3).map((m) => `
          <div class="pm-market">
            <div class="pm-q"><span>${esc(m.question)}</span><b>${fmt(m.prob, 1)}%</b></div>
            <div class="prob-track"><div class="prob-fill" style="width:${m.prob}%"></div></div>
          </div>`).join("")}
      </div>` : "";
    return `
    <div class="card">
      <div class="choke-head">
        <span class="choke-name">${esc(cp.name)}</span>
        <span class="band ${cp.band}">${cp.band} · ${fmt(cp.score, 0)}</span>
      </div>
      <div class="risk-bar"><div class="risk-fill" style="width:${cp.score}%"></div></div>
      <div class="choke-stats">
        <div class="stat"><div class="sk">GDELT 7d mentions</div><div class="sv">${fmtInt(cp.mentions_7d_sample)}${cp.mentions_7d_sample >= 60 ? "+" : ""}</div></div>
        <div class="stat"><div class="sk">News tone</div><div class="sv ${cp.tone < 0 ? "up" : "down"}">${fmt(cp.tone, 2)}</div></div>
        <div class="stat"><div class="sk">RSS hits 72h</div><div class="sv">${fmtInt(cp.news_hits)}</div></div>
        <div class="stat"><div class="sk">PM disruption</div><div class="sv">${pm && pm.markets[0] ? fmt(100 - pm.markets[0].prob, 0) + "%" : "—"}</div></div>
      </div>
      <div class="mini-headlines">
        ${(cp.top_headlines || []).map((h) => `<div class="mini-hl">${esc(h.title)} <span class="news-src">${esc(h.source || "")}</span></div>`).join("")}
      </div>
      ${pmHtml}
    </div>`;
  }).join("");
}

function renderPM(d) {
  const evs = d.prediction_markets?.polymarket || [];
  $("pm-events").innerHTML = evs.map((e) => `
    <div class="pm-event">
      <div class="pm-title"><a href="${esc(e.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(e.title)}</a></div>
      <div class="pm-meta">
        <span class="cat-tag cat-${e.category}">${e.category}</span>
        <span>vol $${fmtInt(e.volume)}</span><span>liq $${fmtInt(e.liquidity)}</span><span>ends ${e.end || "—"}</span>
      </div>
      ${e.markets.slice(0, 5).map((m) => `
        <div class="pm-market">
          <div class="pm-q"><span>${esc(m.question)}</span><b>${fmt(m.prob, 1)}%</b></div>
          <div class="prob-track"><div class="prob-fill" style="width:${m.prob}%"></div></div>
        </div>`).join("")}
    </div>`).join("") || '<div class="dim small">No events matched.</div>';
}

function renderConflict(d) {
  const c = d.conflict || {};
  $("conflict-panel").innerHTML = `
    <div class="conflict-big">
      <div class="cb"><div class="cv" style="color:${(c.p_us_invades_iran || 0) > 20 ? "var(--red)" : "var(--text)"}">${fmt(c.p_us_invades_iran, 1)}%</div><div class="ck">P(US invades Iran) · Polymarket</div></div>
      <div class="cb"><div class="cv" style="color:${(c.p_ceasefire_holds || 0) < 60 ? "var(--red)" : "var(--green)"}">${fmt(c.p_ceasefire_holds, 1)}%</div><div class="ck">P(ceasefire holds) · Polymarket</div></div>
    </div>
    <div class="macro-rows">
      <div class="macro-row"><span class="k">Iran news tone (GDELT lexicon)</span><span class="v ${(c.iran_news_tone ?? 0) < 0 ? "up" : "down"}">${fmt(c.iran_news_tone, 2)}</span></div>
      <div class="macro-row"><span class="k">Conflict component score</span><span class="v">${fmt(c.score, 1)} · ${c.band}</span></div>
    </div>`;
  const ids = ["warrisk", "hurricane"];
  $("geo-tier3").innerHTML = (d.tier3_signals || []).filter((t) => ids.includes(t.id)).map(t3Card).join("");
  $("kalshi-geo").innerHTML = (d.prediction_markets?.kalshi_geo || []).map((e) => `
    <div class="kgeo">
      <div class="kgeo-title">${esc(e.title)}</div>
      ${e.markets.slice(0, 4).map((m) => `
        <div class="pm-market">
          <div class="pm-q"><span>${esc(m.title)}</span><b>${fmt(m.prob, 1)}%</b></div>
          <div class="prob-track"><div class="prob-fill" style="width:${m.prob}%"></div></div>
        </div>`).join("") || '<div class="dim small">no quoted markets</div>'}
    </div>`).join("") || '<div class="dim small">No open geopolitical events on Kalshi.</div>';
}

/* ================= NEWS ================= */

function renderNewsFilters(d) {
  const counts = {};
  (d.news || []).forEach((n) => (n.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $("news-filters").innerHTML =
    `<button class="nf-btn ${NEWS_FILTER === null ? "active" : ""}" data-f="">all</button>` +
    top.map(([t, c]) => `<button class="nf-btn ${NEWS_FILTER === t ? "active" : ""}" data-f="${t}">${t} ${c}</button>`).join("");
}

$("news-filters").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".nf-btn");
  if (!btn) return;
  NEWS_FILTER = btn.dataset.f || null;
  renderNewsFilters(DATA);
  renderNews(DATA);
});

function renderNews(d) {
  let items = d.news || [];
  if (NEWS_FILTER) items = items.filter((n) => (n.tags || []).includes(NEWS_FILTER));
  $("news-feed").innerHTML = items.map((n) => `
    <div class="news-item ${n.sentiment < 0 ? "neg" : n.sentiment > 0 ? "pos" : ""}">
      <a href="${esc(n.url)}" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none">${esc(n.title)}</a>
      <div class="nm">
        <span class="news-src">${esc(n.source)} · ${esc(n.ts || "")}</span>
        ${(n.tags || []).slice(0, 5).map((t) => `<span class="tag ${t}">${t}</span>`).join("")}
      </div>
    </div>`).join("") || '<div class="dim small">No recent headlines.</div>';
}

/* ================= ORCHESTRATION ================= */

function renderPills(d) {
  $("source-pills").innerHTML = Object.entries(d.sources || {}).map(([k, v]) =>
    `<span class="pill ${v}">${k}</span>`).join("");
  $("updated").textContent = `updated ${(d.updated || "").replace("T", " ").replace("Z", "")} UTC`;
}

function render(d) {
  DATA = d;
  renderPills(d);
  renderGauge(d.risk);
  renderPrices(d);
  renderCurveCard(d);
  renderMacroMini(d);
  renderCurveChart(d);
  renderTier3Strip(d);
  renderYields(d);
  renderVolCards(d);
  renderFxCards(d);
  renderCrackPanel(d);
  renderBenchCards(d);
  renderCot(d);
  renderRigPanel(d);
  renderKalshi(d);
  renderSpr(d);
  renderInvPanel(d);
  renderSupplyTier3(d);
  renderChokepoints(d);
  renderPM(d);
  renderConflict(d);
  renderNewsFilters(d);
  renderNews(d);
  $("loading").classList.add("hidden");
  $("content").classList.remove("hidden");
  setTimeout(() => Object.values(charts).forEach((c) => c.resize()), 50);
}

let _tickBusy = false;
let _tickTimer = null;

function scheduleTick(ms) {
  if (_tickTimer !== null) clearTimeout(_tickTimer);
  _tickTimer = setTimeout(() => tick(), ms);
}

async function tick() {
  if (_tickBusy) return;
  _tickBusy = true;
  let next = 60000;
  try {
    const r = await fetch("/api/dashboard");
    if (r.status === 202) next = 5000;
    else if (r.ok) render(await r.json());
  } catch (e) {
    console.error(e);
  }
  _tickBusy = false;
  scheduleTick(next);
}

$("refresh-btn").addEventListener("click", async () => {
  $("refresh-btn").classList.add("spin");
  await fetch("/api/refresh", { method: "POST" });
  setTimeout(() => $("refresh-btn").classList.remove("spin"), 3000);
  scheduleTick(8000);
});

window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

scheduleTick(0);
