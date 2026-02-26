/**
 * Demo data for the Thanos status card.
 *
 * Representative data for a multi-cluster environment running Thanos for
 * global query view and long-term metric storage. Used when the dashboard
 * is in demo mode or when no Thanos instance is connected.
 */

export interface ThanosDemoData {
  targets: Array<{ name: string; health: 'up' | 'down'; lastScrape: string }>
  storeGateways: Array<{ name: string; health: 'healthy' | 'unhealthy'; minTime: string; maxTime: string }>
  queryHealth: 'healthy' | 'degraded'
  lastCheckTime: string
}

export const THANOS_DEMO_DATA: ThanosDemoData = {
  targets: [
    { name: 'prometheus-k8s-0', health: 'up', lastScrape: new Date(Date.now() - 15_000).toISOString() },
    { name: 'prometheus-k8s-1', health: 'up', lastScrape: new Date(Date.now() - 20_000).toISOString() },
    { name: 'prometheus-remote-1', health: 'up', lastScrape: new Date(Date.now() - 30_000).toISOString() },
    { name: 'prometheus-remote-2', health: 'down', lastScrape: new Date(Date.now() - 120_000).toISOString() },
  ],
  storeGateways: [
    { name: 'store-gw-0', health: 'healthy', minTime: '2025-01-01T00:00:00Z', maxTime: new Date().toISOString() },
    { name: 'store-gw-1', health: 'healthy', minTime: '2025-01-01T00:00:00Z', maxTime: new Date().toISOString() },
    { name: 'store-gw-2', health: 'unhealthy', minTime: '2025-06-01T00:00:00Z', maxTime: new Date(Date.now() - 3_600_000).toISOString() },
  ],
  // 1 target down + 1 store unhealthy → degraded
  queryHealth: 'degraded',
  lastCheckTime: new Date(Date.now() - 2 * 60_000).toISOString(), // 2 minutes ago
}
