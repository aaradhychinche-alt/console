/**
 * Demo data for the Metal3 bare metal host status card.
 *
 * These numbers are representative of a mid-size bare-metal provisioning
 * environment managed by Metal3. They are used when the dashboard is in
 * demo mode or when no Kubernetes clusters are connected.
 *
 * Note: bmcUnreachable > 0 and provisioningStates.provisioning > 0 ensures
 * the demo data is internally consistent with the "degraded" health status.
 */

export interface Metal3DemoData {
  totalHosts: number
  provisioningStates: {
    provisioned: number
    provisioning: number
    deprovisioned: number
    available: number
    error: number
  }
  bmcReachable: number
  bmcUnreachable: number
  health: 'healthy' | 'degraded'
  lastUpdated: string
}

export const METAL3_DEMO_DATA: Metal3DemoData = {
  totalHosts: 12,
  provisioningStates: {
    provisioned: 8,
    provisioning: 2,
    deprovisioned: 1,
    available: 0,
    error: 1,
  },
  // 2 BMCs unreachable → health is "degraded"
  bmcReachable: 10,
  bmcUnreachable: 2,
  health: 'degraded',
  lastUpdated: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 minutes ago
}
