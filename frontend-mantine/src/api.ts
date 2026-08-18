import type { DashboardData } from './types';

export class WarmingUpError extends Error {
  info: Record<string, unknown>;
  constructor(info: Record<string, unknown>) {
    super('warming_up');
    this.name = 'WarmingUpError';
    this.info = info;
  }
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  if (res.status === 202) {
    throw new WarmingUpError(await res.json());
  }
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return (await res.json()) as DashboardData;
}

export async function triggerRefresh(): Promise<void> {
  const res = await fetch('/api/refresh', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Refresh failed: HTTP ${res.status}`);
  }
}