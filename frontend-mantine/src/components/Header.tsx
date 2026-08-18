import { ActionIcon, Group, Text, Title, Tooltip, useMantineColorScheme } from '@mantine/core';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import { SourcePills } from './ui';

export function Header({
  sources,
  updated,
  refreshing,
  onRefresh,
}: {
  sources: Record<string, string>;
  updated: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  return (
    <Group justify="space-between" align="center" h="100%" px="md" wrap="wrap" gap="sm">
      <Group gap={14} wrap="nowrap">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #ffb020, #ff7847)',
            color: '#14100a',
            fontSize: 22,
            boxShadow: '0 0 28px rgba(255,176,32,0.35)',
            flexShrink: 0,
          }}
          aria-hidden
        >
          ◉
        </div>
        <div>
          <Title order={1} fw={800} size="lg" lts={2.5} style={{ whiteSpace: 'nowrap' }}>
            CRUDE<span style={{ color: 'var(--mantine-color-amber-5)' }}>//</span>SIGNAL DESK
          </Title>
          <Text size="xs" c="dimmed" lts={0.6} hiddenFrom="sm">Geopolitical risk monitor for oil futures</Text>
        </div>
      </Group>

      <Group gap={16} wrap="wrap">
        <Group visibleFrom="sm">
          <SourcePills sources={sources} />
        </Group>
        <Group gap={10} wrap="nowrap">
          <Text ff="monospace" size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            updated {updated.replace('T', ' ').replace('Z', '')} UTC
          </Text>
          <Tooltip label="Force refresh">
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Force refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : undefined} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={() => setColorScheme(dark ? 'light' : 'dark')}
              aria-label="Toggle color scheme"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Group>
  );
}