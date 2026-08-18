import { Badge, Group, Progress, ScrollArea, SimpleGrid, Stack, Text } from '@mantine/core';
import { BandBadge, MiniHeadline, Panel, ProbBar, Tier3Card } from '../components/ui';
import { catColor, fmt, fmtInt } from '../lib/format';
import type { DashboardData } from '../types';

export function Geopolitics({ data }: { data: DashboardData }) {
  const c = data.conflict;
  const tier3Geo = data.tier3_signals.filter((t) => ['warrisk', 'hurricane'].includes(t.id));
  const kalshiGeo = data.prediction_markets.kalshi_geo;

  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        {data.chokepoints.map((cp) => {
          const pm = cp.polymarket;
          return (
            <Panel key={cp.id} label={cp.name}>
              <Group justify="space-between" mb={10} wrap="nowrap">
                <BandBadge band={cp.band} value={cp.score} />
              </Group>
              <Progress value={Math.min(100, cp.score)} size={8} radius="xl" transitionDuration={800} />
              <SimpleGrid cols={4} spacing={8} mt="sm" mb="sm">
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '8px 10px' }}>
                  <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8}>GDELT 7d mentions</Text>
                  <Text ff="monospace" fw={600} size="sm" mt={2}>{fmtInt(cp.mentions_7d_sample)}{cp.mentions_7d_sample >= 60 ? '+' : ''}</Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '8px 10px' }}>
                  <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8}>News tone</Text>
                  <Text ff="monospace" fw={600} size="sm" mt={2} c={cp.tone < 0 ? 'red' : 'green'}>{fmt(cp.tone, 2)}</Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '8px 10px' }}>
                  <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8}>RSS hits 72h</Text>
                  <Text ff="monospace" fw={600} size="sm" mt={2}>{fmtInt(cp.news_hits)}</Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '8px 10px' }}>
                  <Text style={{ fontSize: 10 }} c="dimmed" tt="uppercase" lts={0.8}>PM disruption</Text>
                  <Text ff="monospace" fw={600} size="sm" mt={2}>
                    {pm && pm.markets[0] ? `${fmt(100 - pm.markets[0].prob, 0)}%` : '—'}
                  </Text>
                </div>
              </SimpleGrid>
              <Stack gap={6}>
                {cp.top_headlines.map((h, i) => (
                  <MiniHeadline key={i} title={h.title} source={h.source} />
                ))}
              </Stack>
              {pm ? (
                <div style={{ marginTop: 10 }}>
                  <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mb={6}>
                    Polymarket · {pm.title}{' '}
                    <Text span c="dimmed" fw={400} tt="none" size="xs">(${fmtInt(pm.volume)} vol)</Text>
                  </Text>
                  {pm.markets.slice(0, 3).map((m, i) => (
                    <ProbBar key={i} label={m.question} prob={m.prob} />
                  ))}
                </div>
              ) : null}
            </Panel>
          );
        })}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} mb="md">
        <Panel label="Prediction Markets — Polymarket">
          <ScrollArea h={520} type="auto" offsetScrollbars>
            <Stack gap={10}>
              {data.prediction_markets.polymarket.length ? (
                data.prediction_markets.polymarket.map((e) => (
                  <div key={e.id} style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                    <Text size="sm" fw={600} style={{ lineHeight: 1.4 }}>
                      <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {e.title}
                      </a>
                    </Text>
                    <Group gap={10} mt={6} wrap="wrap">
                      <Badge color={catColor(e.category)} variant="light" size="xs" tt="uppercase">{e.category}</Badge>
                      <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">vol ${fmtInt(e.volume)}</Text>
                      <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">liq ${fmtInt(e.liquidity)}</Text>
                      <Text ff="monospace" style={{ fontSize: 10.5 }} c="dimmed">ends {e.end || '—'}</Text>
                    </Group>
                    {e.markets.slice(0, 5).map((m, i) => (
                      <ProbBar key={i} label={m.question} prob={m.prob} />
                    ))}
                  </div>
                ))
              ) : (
                <Text size="xs" c="dimmed">No events matched.</Text>
              )}
            </Stack>
          </ScrollArea>
        </Panel>

        <Panel label="Conflict & Escalation Signals">
          <SimpleGrid cols={2} spacing={10} mb="14px">
            <div style={{ borderRadius: 12, padding: 14, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--mantine-color-default-border)' }}>
              <Text ff="monospace" fw={700} style={{ fontSize: 26 }} c={(c.p_us_invades_iran ?? 0) > 20 ? 'red' : undefined}>
                {fmt(c.p_us_invades_iran, 1)}%
              </Text>
              <Text style={{ fontSize: 10.5 }} c="dimmed" mt="4px" lts={0.5}>P(US invades Iran) · Polymarket</Text>
            </div>
            <div style={{ borderRadius: 12, padding: 14, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--mantine-color-default-border)' }}>
              <Text ff="monospace" fw={700} style={{ fontSize: 26 }} c={(c.p_ceasefire_holds ?? 0) < 60 ? 'red' : 'green'}>
                {fmt(c.p_ceasefire_holds, 1)}%
              </Text>
              <Text style={{ fontSize: 10.5 }} c="dimmed" mt="4px" lts={0.5}>P(ceasefire holds) · Polymarket</Text>
            </div>
          </SimpleGrid>
          <Stack gap={9}>
            <Group justify="space-between" py={7} px={10} style={{ borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
              <Text size="xs" c="dimmed">Iran news tone (GDELT lexicon)</Text>
              <Text size="xs" fw={600} ff="monospace" c={(c.iran_news_tone ?? 0) < 0 ? 'red' : 'green'}>{fmt(c.iran_news_tone, 2)}</Text>
            </Group>
            <Group justify="space-between" py={7} px={10} style={{ borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
              <Text size="xs" c="dimmed">Conflict component score</Text>
              <Text size="xs" fw={600} ff="monospace">{fmt(c.score, 1)} · {c.band}</Text>
            </Group>
          </Stack>

          <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mt={18} mb="sm">War-Risk & Weather Signals</Text>
          {tier3Geo.map((t) => (
            <Tier3Card key={t.id} t={t} />
          ))}

          <Text size="xs" tt="uppercase" fw={700} lts={1.8} c="dimmed" mt={18} mb="sm">Kalshi Geopolitical Events</Text>
          {kalshiGeo.length ? (
            kalshiGeo.map((e, i) => (
              <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mantine-color-default-border)', padding: '10px 0' }}>
                <Text size="xs" fw={600} mb={6}>{e.title}</Text>
                {e.markets.length === 0 ? (
                  <Text size="xs" c="dimmed">no quoted markets</Text>
                ) : (
                  e.markets.slice(0, 4).map((m, j) => (
                    <ProbBar key={j} label={m.title} prob={m.prob} />
                  ))
                )}
              </div>
            ))
          ) : (
            <Text size="xs" c="dimmed">No open geopolitical events on Kalshi.</Text>
          )}
        </Panel>
      </SimpleGrid>
    </>
  );
}