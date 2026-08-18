import { useMemo } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { SimpleGrid, Stack, Text } from '@mantine/core';
import type { EChartsOption } from 'echarts';
import { EChart } from '../components/EChart';
import { BigStat, MacroRow, Panel, Tier3Card } from '../components/ui';
import { chgArrow, chgColor, fmt, fmtInt, signed } from '../lib/format';
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

function sprOption(history: { date?: string; value: number }[]): EChartsOption {
  return {
    grid: { left: 40, right: 8, top: 8, bottom: 18 },
    xAxis: { type: 'category', data: history.map((h) => h.date || ''), ...CHART[scheme].AXIS, axisLabel: { ...CHART[scheme].AXIS.axisLabel, fontSize: 9 } },
    yAxis: { type: 'value', scale: true, ...CHART[scheme].AXIS, axisLabel: { ...CHART[scheme].AXIS.axisLabel, fontSize: 9 } },
    series: [
      {
        type: 'line',
        data: history.map((h) => h.value),
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#a78bfa', width: 1.8 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#a78bfa44' },
              { offset: 1, color: '#a78bfa00' },
            ],
          },
        },
      },
    ],
    tooltip: CHART[scheme].TOOLTIP,
  };
}

export function Supply({ data }: { data: DashboardData }) {
  scheme = useMantineColorScheme().colorScheme !== 'light' ? 'dark' : 'light';
  const spr = data.supply.spr;
  const inv = data.supply.inventories;
  const cs = data.supply.curve_state;

  const sprChart = useMemo(() => (spr?.history?.length ? sprOption(spr.history) : {}), [spr?.history]);

  const prior = (spr?.history ?? []).slice(0, -1);
  const pct = prior.length
    ? Math.round((prior.filter((h) => h.value <= (spr?.last_mb ?? 0)).length / prior.length) * 100)
    : null;

  const tier3Ids = ['floatstor', 'opecspare', 'china'];
  const tier3 = data.tier3_signals.filter((t) => tier3Ids.includes(t.id));

  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
      <Panel label="US Strategic Petroleum Reserve" sub="(weekly, EIA)">
        {spr ? (
          <>
            <SimpleGrid cols={3} spacing={10} mb="sm">
              <BigStat
                v={`${fmt(spr.last_mb, 1)} Mb`}
                k="SPR crude stocks"
                sub={`${chgArrow(spr.change_wow_mb)} ${fmt(Math.abs(spr.change_wow_mb))} Mb w/w`}
                color={spr.change_wow_mb < 0 ? 'red' : 'green'}
              />
              <BigStat
                v={`${spr.change_52w_mb > 0 ? '+' : ''}${fmt(spr.change_52w_mb, 1)}`}
                k="52-week change Mb"
                color={spr.change_52w_mb < 0 ? 'red' : 'green'}
              />
              <BigStat v={pct !== null ? `${pct}%` : '—'} k="52w percentile" sub={`as of ${spr.as_of}`} />
            </SimpleGrid>
            <EChart option={sprChart} height={280} ariaLabel="SPR crude stocks" />
          </>
        ) : (
          <Text size="xs" c="dimmed">SPR data unavailable.</Text>
        )}
      </Panel>

      <Panel label="Commercial Inventories & Curve">
        <Stack gap={9} mt={6}>
          {inv && inv.status === 'ok' ? (
            <>
              <MacroRow k="EIA commercial crude stocks" v={`${fmtInt(inv.last)} k bbl`} />
              <MacroRow
                k="Week-on-week change"
                v={`${inv.change_wow !== undefined && inv.change_wow > 0 ? '+' : ''}${fmt(inv.change_wow, 1)} k bbl`}
                color={chgColor(-(inv.change_wow ?? 0))}
              />
            </>
          ) : (
            <Text size="xs" c="dimmed" mb={10}>
              {inv?.note ||
                'Commercial inventory data requires a free EIA_API_KEY — set it and restart the server.'}
            </Text>
          )}
          {cs ? (
            <>
              <MacroRow
                k="Curve regime"
                v={cs.regime.toUpperCase()}
                color={cs.regime === 'backwardation' ? 'red' : 'green'}
              />
              <MacroRow k="Front vs back spread" v={cs.depth_pct != null ? `${signed(cs.depth_pct)}%` : "—"} />
              <Text size="xs" c="dimmed" mt={8}>
                Deep backwardation = acute physical tightness; contango = ample supply / storage economics dominate.
              </Text>
            </>
          ) : null}
        </Stack>

        <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mt={18} mb="sm">
          Floating Storage & OPEC+ Spare Capacity
        </Text>
        {tier3.map((t) => (
          <Tier3Card key={t.id} t={t} />
        ))}
      </Panel>
    </SimpleGrid>
  );
}