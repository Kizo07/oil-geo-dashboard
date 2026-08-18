import { useMemo } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { Badge, Group, SimpleGrid, Text } from '@mantine/core';
import type { EChartsOption } from 'echarts';
import { EChart } from '../components/EChart';
import { BigStat, Panel } from '../components/ui';
import { chgArrow, chgColor, fmt } from '../lib/format';
import type { DashboardData, Series } from '../types';

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

function lineOption(hist: Series['history'], color: string, opts: { area?: boolean } = {}): EChartsOption {
  if (!hist || !hist.length) return {};
  return {
    grid: { left: 40, right: 8, top: 8, bottom: 18 },
    xAxis: { type: 'category', show: false, data: hist.map((h) => h.date || h.period || ''), ...CHART[scheme].AXIS },
    yAxis: { type: 'value', scale: true, ...CHART[scheme].AXIS, axisLabel: { ...CHART[scheme].AXIS.axisLabel, fontSize: 9 } },
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

function VCard({ label, val, change, unit = '', digits = 2 }: { label: string; val?: number; change?: number; unit?: string; digits?: number }) {
  const has = val !== null && val !== undefined;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 11, padding: '11px 12px' }}>
      <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.9}>{label}</Text>
      <Text ff="monospace" fw={700} size="lg" mt={3} mb={2}>
        {has ? fmt(val, digits) + unit : '—'}
      </Text>
      <Text ff="monospace" style={{ fontSize: 10.5 }} c={has ? chgColor(change) : 'dimmed'}>
        {has ? `${chgArrow(change)} ${fmt(Math.abs(change ?? 0))} 1d` : ''}
      </Text>
    </div>
  );
}

function YieldCell({ tenor, y }: { tenor: string; y?: Series }) {
  if (!y) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 11, padding: '11px 12px' }}>
      <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={1}>UST {tenor}</Text>
      <Text ff="monospace" fw={700} size="xl" my={3}>{fmt(y.last)}%</Text>
      <Text ff="monospace" style={{ fontSize: 10.5 }} c={chgColor(y.change_1d)}>
        {chgArrow(y.change_1d)} {y.change_1d !== undefined ? fmt(Math.abs(y.change_1d)) : ''} 1d
      </Text>
    </div>
  );
}

export function Macro({ data }: { data: DashboardData }) {
  scheme = useMantineColorScheme().colorScheme !== 'light' ? 'dark' : 'light';
  const me = data.macro_ext;
  const ovxChart = useMemo(() => lineOption(me.ovx?.history, '#ff9f43', { area: true }), [me.ovx?.history]);
  const vixChart = useMemo(() => lineOption(data.macro.vix?.history, '#ff4d5e', { area: true }), [data.macro.vix?.history]);
  const cadChart = useMemo(() => lineOption(me.usdcad?.history, '#4cc9f0'), [me.usdcad?.history]);
  const copperChart = useMemo(() => lineOption(me.copper?.history, '#ff9f43'), [me.copper?.history]);
  const rbChart = useMemo(() => lineOption(me.rbof?.history, '#2dd4a7'), [me.rbof?.history]);
  const usoChart = useMemo(() => lineOption(me.uso?.history, '#ffb020'), [me.uso?.history]);

  const crack = me.crack_spread_321;
  const crackLevel =
    crack === null || crack === undefined
      ? ''
      : crack > 35
        ? 'very high — product scarcity'
        : crack > 20
          ? 'healthy refining margins'
          : crack > 8
            ? 'normal'
            : 'weak demand / refining stress';

  return (
    <>
      <Panel label="US Treasuries & Inflation Expectations" mb="md">
        <SimpleGrid cols={{ base: 2, md: 4 }} mb="14px">
          <YieldCell tenor="2Y" y={data.macro.yields.dgs2} />
          <YieldCell tenor="5Y" y={data.macro.yields.dgs5} />
          <YieldCell tenor="10Y" y={data.macro.yields.dgs10} />
          <YieldCell tenor="30Y" y={data.macro.yields.dgs30} />
        </SimpleGrid>
        <Group gap={14} wrap="wrap">
          {me.bei5 ? (
            <Badge color="violet" variant="light" size="lg" ff="monospace" radius="md">
              5y breakeven <b>{fmt(me.bei5.last)}%</b>{' '}
              <Text span c={chgColor(me.bei5.change_1d)}>{chgArrow(me.bei5.change_1d)}{me.bei5.change_1d !== undefined ? fmt(Math.abs(me.bei5.change_1d)) : ''}</Text>
            </Badge>
          ) : null}
          {me.bei10 ? (
            <Badge color="violet" variant="light" size="lg" ff="monospace" radius="md">
              10y breakeven <b>{fmt(me.bei10.last)}%</b>{' '}
              <Text span c={chgColor(me.bei10.change_1d)}>{chgArrow(me.bei10.change_1d)}{me.bei10.change_1d !== undefined ? fmt(Math.abs(me.bei10.change_1d)) : ''}</Text>
            </Badge>
          ) : null}
          <Badge color="violet" variant="light" size="lg" ff="monospace" radius="md">
            2s10s <b>{fmt(data.macro.spread_2s10s)}%</b>
          </Badge>
        </Group>
      </Panel>

      <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
        <Panel label="Volatility & Risk Appetite">
          <SimpleGrid cols={3} spacing={10}>
            <VCard label="VIX" val={data.macro.vix?.last} change={data.macro.vix?.change_1d} />
            <VCard label="OVX oil vol" val={me.ovx?.last} change={me.ovx?.change_1d} />
            <VCard label="OVX z-30d" val={me.ovx?.z30} change={undefined} />
          </SimpleGrid>
          <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8} mt="sm">OVX — oil volatility index · 6w</Text>
          <EChart option={ovxChart} height={110} ariaLabel="OVX oil volatility" />
          <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8} mt="sm">VIX · 6w</Text>
          <EChart option={vixChart} height={110} ariaLabel="VIX" />
        </Panel>

        <Panel label="Dollar, Petro-FX & Growth Proxies">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10}>
            <VCard label="Dollar index" val={data.macro.dxy?.last} change={data.macro.dxy?.change_1d} digits={1} />
            <VCard label="USD/CAD" val={me.usdcad?.price} change={undefined} digits={4} />
            <VCard label="USD/NOK" val={me.usdnok?.price} change={undefined} digits={3} />
            <VCard label="Copper $/lb" val={me.copper?.price} change={undefined} digits={2} />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing={10} mt="sm">
            <div>
              <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8}>USD/CAD · 6w</Text>
              <EChart option={cadChart} height={110} ariaLabel="USD/CAD" />
            </div>
            <div>
              <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8}>Copper · 6w</Text>
              <EChart option={copperChart} height={110} ariaLabel="Copper" />
            </div>
          </SimpleGrid>
        </Panel>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
        <Panel label="Refining Economics — 3:2:1 Crack Spread">
          <SimpleGrid cols={3} spacing={10} mb="sm">
            <BigStat
              v={crack !== null && crack !== undefined ? `$${fmt(crack)}` : '—'}
              k="3:2:1 crack $/bbl"
              sub={crackLevel}
              color={crack !== null && crack !== undefined && crack > 35 ? 'red' : 'amber'}
            />
            <BigStat v={me.rbof?.price ? `$${fmt(me.rbof.price, 3)}` : '—'} k="RBOB gasoline $/gal" />
            <BigStat v={me.heating_oil?.price ? `$${fmt(me.heating_oil.price, 3)}` : '—'} k="Heating oil $/gal" />
          </SimpleGrid>
          <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8}>RBOB gasoline ($/gal) · 6w</Text>
          <EChart option={rbChart} height={110} ariaLabel="RBOB gasoline" />
        </Panel>

        <Panel label="Oil Funds & Benchmarks">
          <SimpleGrid cols={3} spacing={10}>
            <VCard label="USO ETF" val={me.uso?.price} change={undefined} />
            <VCard label="WTI front" val={data.prices.wti.live} change={undefined} />
            <VCard label="Gold" val={data.prices.gold} change={undefined} digits={0} />
          </SimpleGrid>
          <Text style={{ fontSize: 10.5 }} c="dimmed" tt="uppercase" lts={0.8} mt="sm">USO ETF · 6w</Text>
          <EChart option={usoChart} height={110} ariaLabel="USO ETF" />
        </Panel>
      </SimpleGrid>
    </>
  );
}