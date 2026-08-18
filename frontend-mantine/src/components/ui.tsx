import type { ReactNode } from 'react';
import { Badge, Card, Group, Progress, Stack, Text, useMantineColorScheme } from '@mantine/core';
import { bandColor, fmt, fmtInt, sourceColor } from '../lib/format';
import type { Tier3Signal } from '../types';

export function Panel({
  label,
  sub,
  children,
  mb = 'md',
}: {
  label: string;
  sub?: string;
  children: ReactNode;
  mb?: string | number;
}) {
  return (
    <Card mb={mb} style={{ height: '100%' }}>
      <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mb="sm">
        {label} {sub ? <Text span c="dimmed" fw={400} tt="none" lts={0.3} size="xs">{sub}</Text> : null}
      </Text>
      {children}
    </Card>
  );
}

export function BandBadge({ band, value }: { band: string; value?: number }) {
  return (
    <Badge color={bandColor(band)} variant="light" radius="xl" tt="uppercase" size="sm">
      {value !== undefined ? `${fmt(value, 0)} · ` : ''}
      {band}
    </Badge>
  );
}

export function SourcePills({ sources }: { sources: Record<string, string> }) {
  return (
    <Group gap={6} wrap="wrap">
      {Object.entries(sources).map(([k, v]) => (
        <Badge key={k} color={sourceColor(v)} variant="light" size="xs" tt="uppercase" radius="xl">
          {k}
        </Badge>
      ))}
    </Group>
  );
}

export function useChartColors() {
  const dark = useMantineColorScheme().colorScheme !== 'light';
  return {
    axisLine: dark ? '#2a3245' : '#c7cdd9',
    axisLabel: dark ? '#8b93a7' : '#5a6378',
    splitLine: dark ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.07)',
    tooltipBg: dark ? '#111622' : '#ffffff',
    tooltipBorder: dark ? '#2a3245' : '#c7cdd9',
    tooltipText: dark ? '#e8ecf4' : '#1f2937',
    statFill: dark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
  };
}

export function MacroRow({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  const c = useChartColors();
  return (
    <Group justify="space-between" py={7} px={10} style={{ borderRadius: 9, background: c.statFill }} wrap="nowrap">
      <Text size="xs" c="dimmed">{k}</Text>
      <Text size="xs" fw={600} ff="monospace" c={color}>{v}</Text>
    </Group>
  );
}

export function Stat({ k, v, sub }: { k: string; v: ReactNode; sub?: ReactNode }) {
  const c = useChartColors();
  return (
    <div style={{ background: c.statFill, borderRadius: 9, padding: '8px 10px' }}>
      <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8}>{k}</Text>
      <Text ff="monospace" fw={600} size="sm" mt="2px">{v}</Text>
      {sub ? <Text style={{ fontSize: 10 }} c="dimmed" mt="2px">{sub}</Text> : null}
    </div>
  );
}

export function BigStat({ v, k, sub, color }: { v: ReactNode; k: string; sub?: ReactNode; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '13px 14px', textAlign: 'center' }}>
      <Text ff="monospace" fw={700} size="xl" c={color}>{v}</Text>
      <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8} mt="4px">{k}</Text>
      {sub ? <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed" mt="3px">{sub}</Text> : null}
    </div>
  );
}

export function ProbBar({ label, prob, color }: { label: string; prob: number; color?: string }) {
  return (
    <div style={{ marginTop: 9 }}>
      <Group justify="space-between" gap={10} wrap="nowrap" mb={4}>
        <Text size="xs" c="dimmed" style={{ lineHeight: 1.35 }}>{label}</Text>
        <Text ff="monospace" size="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>{fmt(prob, 1)}%</Text>
      </Group>
      <Progress value={Math.min(100, Math.max(0, prob))} color={color ?? 'cyan'} size={6} radius="xl" />
    </div>
  );
}

export function MiniHeadline({ title, source }: { title: string; source?: string }) {
  return (
    <Text size="xs" c="dimmed" style={{ lineHeight: 1.45 }}>
      <Text span c="amber">▸ </Text>
      {title}
      {source ? <Text span ff="monospace" style={{ fontSize: 10 }} c="dimmed"> {source}</Text> : null}
    </Text>
  );
}

export function Tier3Card({ t }: { t: Tier3Signal }) {
  return (
    <div style={{ borderTop: '1px solid var(--mantine-color-default-border)', padding: '11px 0' }}>
      <Group justify="space-between" gap={10} wrap="nowrap">
        <Text size="sm" fw={600}>{t.name}</Text>
        <BandBadge band={t.band} value={t.heat} />
      </Group>
      <Text size="xs" c="dimmed" mt="4px" style={{ lineHeight: 1.45 }}>{t.desc}</Text>
      <Group gap={12} mt="7px" wrap="wrap">
        <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">GDELT 7d: {fmtInt(t.mentions_7d_sample)}{t.mentions_7d_sample >= 60 ? '+' : ''}</Text>
        <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">tone: {fmt(t.tone, 2)}</Text>
        <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">RSS 72h: {fmtInt(t.news_hits)}</Text>
      </Group>
      <Stack gap={6} mt="7px">
        {t.top_headlines.slice(0, 3).map((h, i) => (
          <MiniHeadline key={`g-${i}`} title={h.title} source={h.source} />
        ))}
        {t.rss_headlines.slice(0, 2).map((h, i) => (
          <MiniHeadline key={`r-${i}`} title={h.title} source={h.source} />
        ))}
      </Stack>
    </div>
  );
}