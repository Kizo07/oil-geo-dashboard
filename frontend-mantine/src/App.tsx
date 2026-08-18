import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppShell, Group, Loader, Skeleton, Stack, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchDashboard, triggerRefresh, WarmingUpError } from './api';
import { Header } from './components/Header';
import type { DashboardData } from './types';
import { Geopolitics } from './views/Geopolitics';
import { Macro } from './views/Macro';
import { News } from './views/News';
import { Overview } from './views/Overview';
import { Positioning } from './views/Positioning';
import { Supply } from './views/Supply';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'macro', label: 'Macro & Rates' },
  { value: 'positioning', label: 'Positioning' },
  { value: 'supply', label: 'Supply' },
  { value: 'geopolitics', label: 'Geopolitics' },
  { value: 'news', label: 'News' },
];

const initialTab = (() => {
  const h = (window.location.hash || '').replace('#', '');
  return TABS.some((t) => t.value === h) ? h : 'overview';
})();

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'warming' | 'ready' | 'error'>('loading');
  const dataRef = useRef<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<string | null>(initialTab);

  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const schedule = useCallback((delay: number) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void tick();
    }, delay);
  }, []);

  const tick = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    let next = 60000;
    try {
      const d = await fetchDashboard();
      dataRef.current = d;
      setData(d);
      setStatus('ready');
      setError(null);
    } catch (e) {
      // Legacy behavior: once data is loaded, keep showing the last snapshot on
      // transient failures instead of unmounting the dashboard.
      if (dataRef.current) {
        if (!(e instanceof WarmingUpError)) {
          notifications.show({
            title: 'Update failed',
            message: 'Showing the last loaded snapshot — retrying automatically.',
            color: 'yellow',
            autoClose: 4000,
          });
        }
        next = e instanceof WarmingUpError ? 5000 : 15000;
      } else if (e instanceof WarmingUpError) {
        setStatus('warming');
        next = 5000;
      } else {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
        next = 15000;
      }
    } finally {
      busyRef.current = false;
      schedule(next);
    }
  }, [schedule]);

  useEffect(() => {
    void tick();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [tick]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerRefresh();
      notifications.show({
        title: 'Refresh started',
        message: 'Collectors are refreshing — data will update shortly.',
        color: 'amber',
        autoClose: 3000,
      });
      schedule(8000);
    } catch (e) {
      notifications.show({
        title: 'Refresh failed',
        message: e instanceof Error ? e.message : String(e),
        color: 'red',
      });
    } finally {
      setRefreshing(false);
    }
  }, [schedule]);

  const onTabChange = (value: string | null) => {
    setTab(value);
    if (value) window.history.replaceState(null, '', `#${value}`);
  };

  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '');
      if (TABS.some((t) => t.value === h)) setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <div id="bg-glow" aria-hidden />
      <AppShell header={{ height: { base: 96, sm: 64 } }} padding={{ base: 'sm', sm: 'md' }}>
      <AppShell.Header>
        <Header
          sources={data?.sources ?? {}}
          updated={data?.updated ?? '—'}
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
        />
      </AppShell.Header>

      <AppShell.Main>
        <Tabs value={tab} onChange={onTabChange} mb="md" keepMounted={false}>
          <Tabs.List aria-label="Dashboard sections">
            {TABS.map((t) => (
              <Tabs.Tab key={t.value} value={t.value} tt="uppercase" fw={600} size="xs" lts={0.8}>
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

        {status === 'loading' || status === 'warming' ? (
          <Stack align="center" py={80} gap="md">
            <Loader color="amber" size="lg" />
            <Text c="dimmed" size="sm" ta="center">
              {status === 'warming'
                ? 'Warming up collectors — first refresh can take ~60s (GDELT rate limits)…'
                : 'Loading dashboard…'}
            </Text>
            <Skeleton height={120} width="100%" radius="md" />
            <Skeleton height={120} width="100%" radius="md" />
          </Stack>
        ) : null}

        {status === 'error' ? (
          <Alert color="red" title="Dashboard unavailable" mb="md">
            {error} — retrying automatically.
          </Alert>
        ) : null}

        {status === 'ready' && data ? (
          <>
              <Tabs.Panel value="overview">
                <Overview data={data} />
              </Tabs.Panel>
              <Tabs.Panel value="macro">
                <Macro data={data} />
              </Tabs.Panel>
              <Tabs.Panel value="positioning">
                <Positioning data={data} />
              </Tabs.Panel>
              <Tabs.Panel value="supply">
                <Supply data={data} />
              </Tabs.Panel>
              <Tabs.Panel value="geopolitics">
                <Geopolitics data={data} />
              </Tabs.Panel>
              <Tabs.Panel value="news">
                <News data={data} />
              </Tabs.Panel>

            <Group justify="space-between" gap={12} wrap="wrap" mt="lg" pt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="xs" c="dimmed">
                Sources: Yahoo Finance · FRED · CFTC · Baker Hughes · EIA · Polymarket · Kalshi · GDELT · Google News RSS · Al Jazeera · BBC
              </Text>
              <Text size="xs" c="dimmed">Local dashboard — data may be delayed. Not investment advice.</Text>
            </Group>
          </>
        ) : null}
        </Tabs>
      </AppShell.Main>
      </AppShell>
    </>
  );
}