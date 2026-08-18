import { useMemo, useState } from 'react';
import { Badge, Chip, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { Panel } from '../components/ui';
import type { DashboardData, NewsItem } from '../types';

function tagColor(tag: string): string {
  switch (tag) {
    case 'hormuz':
      return 'red';
    case 'red-sea':
    case 'iran':
      return 'orange';
    case 'opec':
      return 'violet';
    default:
      return 'cyan';
  }
}

function NewsItemRow({ n }: { n: NewsItem }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.025)',
        borderLeft: `3px solid ${n.sentiment < 0 ? 'var(--mantine-color-red-5)' : n.sentiment > 0 ? 'var(--mantine-color-green-5)' : 'transparent'}`,
      }}
    >
      <Text size="xs" style={{ lineHeight: 1.45 }}>
        <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          {n.title}
        </a>
      </Text>
      <Group gap={8} mt={5} wrap="wrap">
        <Text ff="monospace" style={{ fontSize: 10 }} c="dimmed">{n.source} · {n.ts || ''}</Text>
        {n.tags.slice(0, 5).map((t) => (
          <Badge key={t} color={tagColor(t)} variant="light" size="xs" tt="uppercase" ff="monospace">
            {t}
          </Badge>
        ))}
      </Group>
    </div>
  );
}

export function News({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    data.news.forEach((n) => (n.tags || []).forEach((t) => { c[t] = (c[t] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [data.news]);

  const items = useMemo(
    () => (filter ? data.news.filter((n) => (n.tags || []).includes(filter)) : data.news),
    [data.news, filter],
  );

  return (
    <Panel label="News Flow" sub="(72h, deduped, lexicon-scored)">
      <Group gap={6} wrap="wrap" mb="md">
        <Chip
          checked={filter === null}
          onChange={() => setFilter(null)}
          variant="light"
          size="xs"
          radius="xl"
          tt="uppercase"
        >
          all
        </Chip>
        {counts.map(([t, c]) => (
          <Chip
            key={t}
            checked={filter === t}
            onChange={() => setFilter(filter === t ? null : t)}
            variant="light"
            size="xs"
            radius="xl"
            tt="uppercase"
          >
            {t} {c}
          </Chip>
        ))}
      </Group>
      <ScrollArea h={560} type="auto" offsetScrollbars>
        <Stack gap={8}>
          {items.length ? (
            items.map((n, i) => <NewsItemRow key={i} n={n} />)
          ) : (
            <Text size="xs" c="dimmed">No recent headlines.</Text>
          )}
        </Stack>
      </ScrollArea>
    </Panel>
  );
}