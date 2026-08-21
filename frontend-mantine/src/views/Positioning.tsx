import { useMemo } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { SimpleGrid, Text } from '@mantine/core';
import type { EChartsOption } from 'echarts';
import { EChart } from '../components/EChart';
import { BigStat, Panel } from '../components/ui';
import { chgArrow, fmt, fmtInt } from '../lib/format';
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

function cotOption(history: { date: string; net: number }[]): EChartsOption {
  return {
    grid: { left: 55, right: 12, top: 20, bottom: 28 },
    tooltip: CHART[scheme].TOOLTIP,
    xAxis: { type: 'category', data: history.map((h) => h.date), ...CHART[scheme].AXIS },
    yAxis: { type: 'value', scale: true, ...CHART[scheme].AXIS },
    series: [
      {
        type: 'bar',
        data: history.map((h) => ({
          value: h.net,
          itemStyle: {
            color: h.net >= 0 ? 'rgba(45,212,167,0.8)' : 'rgba(255,77,94,0.8)',
            borderRadius: [3, 3, 0, 0],
          },
        })),
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0, lineStyle: { color: 'rgba(255,255,255,0.25)' } }] },
      },
    ],
  };
}

function kalshiOption(points: { strike: number; prob: number }[]): EChartsOption {
  return {
    grid: { left: 44, right: 14, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#111622',
      borderColor: '#2a3245',
      textStyle: { color: '#e8ecf4', fontSize: 12 },
      formatter: (p: unknown) => {
        const arr = p as { name: string; value: number }[];
        return `strike $${arr[0].name}<br/>P(settle &gt; strike): <b>${fmt(arr[0].value, 1)}%</b>`;
      },
    },
    xAxis: { type: 'category', data: points.map((p) => p.strike), ...CHART[scheme].AXIS, axisLabel: { ...CHART[scheme].AXIS.axisLabel, formatter: '${value}' } },
    yAxis: { type: 'value', max: 100, ...CHART[scheme].AXIS, axisLabel: { ...CHART[scheme].AXIS.axisLabel, formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        data: points.map((p) => ({
          value: p.prob,
          itemStyle: { color: p.prob >= 50 ? 'rgba(45,212,167,0.85)' : 'rgba(255,77,94,0.8)', borderRadius: [3, 3, 0, 0] },
        })),
        barWidth: '62%',
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 50, label: { formatter: '50%', color: '#8b93a7', fontSize: 10 }, lineStyle: { color: 'rgba(255,255,255,0.25)', type: 'dashed' } }],
        },
      },
    ],
  };
}

export function Positioning({ data }: { data: DashboardData }) {
  scheme = useMantineColorScheme().colorScheme !== 'light' ? 'dark' : 'light';
  const cot = data.positioning.cot;
  const rig = data.positioning.rig_count;
  const ladder = data.prediction_markets.kalshi_ladder;

  const cotChart = useMemo(() => (cot?.history?.length ? cotOption(cot.history) : {}), [cot?.history, scheme]);
  const kalshiChart = useMemo(
    () => (ladder?.points?.length ? kalshiOption(ladder.points) : {}),
    [ladder?.points, scheme],
  );

  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
      <Panel label="CFTC COT — Managed Money, NYMEX WTI" sub="(futures only, weekly)">
        {cot ? (
          <>
            <SimpleGrid cols={3} spacing={10} mb="sm">
              <BigStat
                v={`${cot.net >= 0 ? '+' : ''}${fmtInt(cot.net)}`}
                k="Managed money net"
                sub={`${chgArrow(cot.change_wow)} ${fmtInt(Math.abs(cot.change_wow))} w/w`}
                color={cot.net >= 0 ? 'green' : 'red'}
              />
              <BigStat v={`${fmt(cot.net_pct_oi, 1)}%`} k="Net / open interest" sub={`OI ${fmtInt(cot.oi)}`} />
              <BigStat v={`${fmt(cot.percentile_26w, 0)}%`} k="26-week percentile" sub={`as of ${cot.as_of}`} />
            </SimpleGrid>
            <EChart option={cotChart} height={280} ariaLabel="CFTC COT managed money net" />
          </>
        ) : (
          <Text size="xs" c="dimmed">CFTC data unavailable.</Text>
        )}
      </Panel>

      <Panel label="Baker Hughes Rig Count" sub="(US, weekly)">
        {rig ? (
          <>
            <SimpleGrid cols={3} spacing={10} mb="sm">
              <BigStat
                v={fmtInt(rig.us_oil)}
                k="US oil rigs"
                sub={`${chgArrow(rig.us_oil_wow)} ${fmtInt(Math.abs(rig.us_oil_wow ?? 0))} w/w · ${rig.us_oil_yoy != null ? `${rig.us_oil_yoy > 0 ? '+' : ''}${fmtInt(rig.us_oil_yoy)}` : ''} y/y`}
              />
              <BigStat
                v={fmtInt(rig.us_gas)}
                k="US gas rigs"
                sub={`${chgArrow(rig.us_gas_wow)} ${fmtInt(Math.abs(rig.us_gas_wow ?? 0))} w/w`}
              />
              <BigStat v={fmtInt(rig.us_total)} k="US total" sub={`as of ${rig.as_of}`} />
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Rig count is the earliest leading indicator of future US shale supply — sustained moves foreshadow production shifts 6–12 months out.
            </Text>
          </>
        ) : (
          <Text size="xs" c="dimmed">Rig count unavailable.</Text>
        )}

        <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mt={18} mb="sm">
          Kalshi — P(WTI settlement &gt; strike) {ladder?.date ? <Text span c="dimmed" fw={400} tt="none" size="xs">· expiry {ladder.date}</Text> : null}
        </Text>
        {ladder?.points?.length ? (
          <EChart option={kalshiChart} height={210} ariaLabel="Kalshi WTI ladder" />
        ) : (
          <Text size="xs" c="dimmed" py={20}>No open Kalshi WTI ladder found.</Text>
        )}
      </Panel>
    </SimpleGrid>
  );
}