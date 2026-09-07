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
      axisLine: { lineStyle: { color: '#1e4254' } },
      axisLabel: { color: '#a1b4c4', fontFamily: 'IBM Plex Mono', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(8,191,255,0.05)' } },
    },
    TOOLTIP: {
      trigger: 'axis' as const,
      backgroundColor: '#07131d',
      borderColor: 'rgba(86,183,229,0.34)',
      textStyle: { color: '#edf7fc', fontSize: 11 },
    },
  },
  light: {
    AXIS: {
      axisLine: { lineStyle: { color: '#d3e3ee' } },
      axisLabel: { color: '#445e72', fontFamily: 'IBM Plex Mono', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0,109,159,0.06)' } },
    },
    TOOLTIP: {
      trigger: 'axis' as const,
      backgroundColor: '#ffffff',
      borderColor: 'rgba(17,93,133,0.32)',
      textStyle: { color: '#102d42', fontSize: 11 },
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
        lineStyle: { color: '#cf9440', width: 1.8 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#cf944044' },
              { offset: 1, color: '#cf944000' },
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

  const sprChart = useMemo(() => (spr?.history?.length ? sprOption(spr.history) : {}), [spr?.history, scheme]);

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