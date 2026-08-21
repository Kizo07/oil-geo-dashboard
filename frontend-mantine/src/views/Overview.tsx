import { useMemo } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { EChartsOption } from 'echarts';
import { EChart } from '../components/EChart';
import { MacroRow, Panel } from '../components/ui';
import { chgColor, fmt, fmtInt, signed } from '../lib/format';
import type { DashboardData } from '../types';

// Chart cosmetics adapt to the active color scheme.
const CHART = {
  dark: {
    AXIS: {
      axisLine: { lineStyle: { color: '#2a3245' } },
      axisLabel: { color: '#8b93a7', fontFamily: 'JetBrains Mono', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.045)' } },
    },
    TOOLTIP: {
      trigger: 'axis' as const,
      backgroundColor: '#111622',
      borderColor: '#2a3245',
      textStyle: { color: '#e8ecf4', fontSize: 11 },
    },
  },
  light: {
    AXIS: {
      axisLine: { lineStyle: { color: '#c7cdd9' } },
      axisLabel: { color: '#5a6378', fontFamily: 'JetBrains Mono', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(15,23,42,0.07)' } },
    },
    TOOLTIP: {
      trigger: 'axis' as const,
      backgroundColor: '#ffffff',
      borderColor: '#c7cdd9',
      textStyle: { color: '#1f2937', fontSize: 11 },
    },
  },
};

let scheme: 'dark' | 'light' = 'dark';

function gaugeOption(composite: number, band: string): EChartsOption {
  const color =
    composite >= 65 ? '#ff4d5e' : composite >= 45 ? '#ff9f43' : composite >= 25 ? '#ffd166' : '#2dd4a7';
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: '100%',
        center: ['50%', '62%'],
        progress: {
          show: true,
          width: 16,
          roundCap: true,
          itemStyle: { color, shadowBlur: 18, shadowColor: color },
        },
        axisLine: { lineStyle: { width: 16, color: [[1, 'rgba(255,255,255,0.07)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '34%'], color: '#8b93a7', fontSize: 12, fontFamily: 'Inter' },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-4%'],
          fontSize: 40,
          fontWeight: 800,
          fontFamily: 'JetBrains Mono',
          color,
          formatter: (v: number) => v.toFixed(1),
        },
        data: [{ value: composite, name: band.toUpperCase() }],
      },
    ],
  };
}

function lineOption(
  hist: { date?: string; period?: string; value: number }[] | undefined,
  color: string,
  opts: { area?: boolean; xAxis?: boolean; left?: number; yFmt?: string } = {},
): EChartsOption {
  if (!hist || !hist.length) return {};
  return {
    grid: { left: opts.left ?? 40, right: 8, top: 8, bottom: 18 },
    xAxis: {
      type: 'category',
      show: opts.xAxis !== false,
      data: hist.map((h) => h.date || h.period || ''),
      ...CHART[scheme].AXIS,
      axisLabel: { ...CHART[scheme].AXIS.axisLabel, fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      ...CHART[scheme].AXIS,
      axisLabel: { ...CHART[scheme].AXIS.axisLabel, fontSize: 9, formatter: opts.yFmt || '{value}' },
    },
    series: [
      {
        type: 'line',
        data: hist.map((h) => h.value),
        showSymbol: false,
        smooth: true,
        lineStyle: { color, width: 1.8 },
        areaStyle: opts.area
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}44` },
                  { offset: 1, color: `${color}00` },
                ],
              },
            }
          : undefined,
      },
    ],
    tooltip: CHART[scheme].TOOLTIP,
  };
}

function curveOption(curve: DashboardData['prices']['curve']): EChartsOption {
  if (!curve.length) return {};
  return {
    grid: { left: 48, right: 18, top: 26, bottom: 30 },
    tooltip: CHART[scheme].TOOLTIP,
    xAxis: { type: 'category', data: curve.map((p) => p.contract), ...CHART[scheme].AXIS },
    yAxis: { type: 'value', scale: true, ...CHART[scheme].AXIS },
    series: [
      {
        type: 'line',
        data: curve.map((p) => p.price),
        smooth: true,
        showSymbol: true,
        symbolSize: 7,
        lineStyle: { color: '#4cc9f0', width: 2.5 },
        itemStyle: { color: '#4cc9f0', borderColor: '#07090f', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(76,201,240,0.22)' },
              { offset: 1, color: 'rgba(76,201,240,0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: curve[0].price,
              label: { formatter: 'front', color: '#8b93a7', fontSize: 10 },
              lineStyle: { color: 'rgba(255,176,32,0.5)', type: 'dashed' },
            },
          ],
        },
      },
    ],
  };
}

export function Overview({ data }: { data: DashboardData }) {
  scheme = useMantineColorScheme().colorScheme !== 'light' ? 'dark' : 'light';
  const gauge = useMemo(
    () => gaugeOption(data.risk.composite, data.risk.band),
    [data.risk.composite, data.risk.band],
  );
  const wtiSpark = useMemo(
    () => lineOption(data.prices.wti.history, '#ffb020', { area: true, xAxis: false, left: 0 }),
    [data.prices.wti.history, scheme],
  );
  const curve = useMemo(() => curveOption(data.prices.curve), [data.prices.curve, scheme]);

  const wti = data.prices.wti;
  const cs = data.prices.curve_state;
  const bw = data.macro_ext.brent_wti_spread;
  const m = data.macro;

  const macroRows: [string, string, string][] = [];
  if (m.spread_2s10s !== null && m.spread_2s10s !== undefined)
    macroRows.push(['2s10s spread', `${fmt(m.spread_2s10s, 2)}%`, chgColor(-m.spread_2s10s)]);
  if (m.dxy) macroRows.push(['Dollar index', fmt(m.dxy.last, 1), chgColor(m.dxy.change_1d)]);
  if (m.vix) macroRows.push(['VIX', fmt(m.vix.last, 1), chgColor(m.vix.change_1d)]);
  if (data.macro_ext.ovx)
    macroRows.push(['OVX (oil vol)', fmt(data.macro_ext.ovx.last, 1), chgColor(data.macro_ext.ovx.change_1d)]);
  if (data.positioning.cot)
    macroRows.push(['MM net COT', fmtInt(data.positioning.cot.net), chgColor(data.positioning.cot.change_wow)]);

  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} mb="md">
        <Panel label="Oil Geopolitical Risk Index">
          <EChart option={gauge} height={190} ariaLabel={`Risk index ${data.risk.composite}`} />
          <Group gap={6} wrap="wrap" mt={4}>
            {Object.entries(data.risk.components).map(([k, v]) => (
              <Badge key={k} variant="light" color="gray" size="sm" ff="monospace" radius="md">
                {k} <b>{fmt(v, 0)}</b> <span style={{ opacity: 0.6 }}>×{data.risk.weights[k]}</span>
              </Badge>
            ))}
          </Group>
        </Panel>

        <Panel label="WTI Crude — Front Month">
          <Group align="baseline" gap={12} wrap="nowrap">
            <Text
              ff="monospace"
              fw={700}
              style={{
                fontSize: 44,
                background: 'linear-gradient(120deg, var(--mantine-color-text), var(--mantine-color-amber-5))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {fmt(wti.live)}
            </Text>
            {cs ? (
              <Badge color="amber" variant="light" ff="monospace" size="sm" radius="md">
                {cs.front_contract}
              </Badge>
            ) : null}
          </Group>
          <EChart option={wtiSpark} height={64} ariaLabel="WTI price history" />
          <Group gap={18} wrap="wrap" mt={8}>
            <Text size="xs">
              <Text span c="dimmed">Brent </Text>
              <Text span ff="monospace">{fmt(data.prices.brent.live ?? data.prices.brent.spot_eia)}</Text>
            </Text>
            <Text size="xs">
              <Text span c="dimmed">B–W spread </Text>
              <Text span ff="monospace">{bw !== null && bw !== undefined ? signed(bw) : '—'}</Text>
            </Text>
            <Text size="xs">
              <Text span c="dimmed">Gold </Text>
              <Text span ff="monospace">{data.prices.gold ? fmt(data.prices.gold, 0) : '—'}</Text>
            </Text>
          </Group>
        </Panel>

        <Panel label="Futures Curve Structure">
          {cs ? (
            <>
              <Text
                fw={800}
                lts={1.5}
                mt="14px"
                mb="6px"
                c={cs.regime === 'backwardation' ? 'red' : 'green'}
                style={{
                  fontSize: 26,
                  textShadow: cs.regime === 'backwardation' ? '0 0 24px rgba(255,77,94,0.4)' : '0 0 24px rgba(45,212,167,0.35)',
                }}
              >
                {cs.regime === 'backwardation' ? '◣ BACKWARDATION' : '◢ CONTANGO'}
              </Text>
              <Text ff="monospace" size="sm" mb={8}>
                {signed(cs.depth_pct)}%{' '}
                <Text span c="dimmed" size="xs">
                  front ({cs.front_contract}) vs {cs.back_contract} · {cs.n_contracts} contracts
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {cs.regime === 'backwardation'
                  ? 'Near-term supply tightness — spot premium over deferred months. Deep backwardation often accompanies acute geopolitical supply risk.'
                  : 'Market well supplied — deferred months trade at a premium (storage economics dominate).'}
              </Text>
            </>
          ) : (
            <Text c="dimmed">N/A</Text>
          )}
        </Panel>

        <Panel label="Macro Pulse">
          <Stack gap={9} mt={6}>
            {macroRows.map(([k, v, c]) => (
              <MacroRow key={k} k={k} v={v} color={c} />
            ))}
          </Stack>
        </Panel>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
        <Panel label="WTI Futures Curve" sub="(contract months, live)">
          <EChart option={curve} height={280} ariaLabel="WTI futures curve" />
        </Panel>
        <Panel label="Emerging Signal Heat" sub="(GDELT 7d + RSS 72h)">
          <Stack gap={9}>
            {data.tier3_signals.map((t) => (
              <Group key={t.id} gap={10} wrap="nowrap">
                <Text size="xs" fw={500} style={{ width: 200, flexShrink: 0 }}>{t.name}</Text>
                <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${t.heat}%`,
                      borderRadius: 99,
                      background: 'linear-gradient(90deg, #4cc9f0, #ffb020, #ff4d5e)',
                    }}
                  />
                </div>
                <Text ff="monospace" size="xs" c="dimmed" style={{ width: 42, textAlign: 'right' }}>
                  {fmt(t.heat, 0)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Panel>
      </SimpleGrid>
    </>
  );
}