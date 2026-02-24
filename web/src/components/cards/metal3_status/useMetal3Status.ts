import { useCache } from '../../../lib/cache'
import { useCardLoadingState } from '../CardDataContext'
import { METAL3_DEMO_DATA, type Metal3DemoData } from './demoData'

export interface Metal3Status {
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

const CACHE_KEY = 'metal3-status'

const INITIAL_DATA: Metal3Status = {
  totalHosts: 0,
  provisioningStates: {
    provisioned: 0,
    provisioning: 0,
    deprovisioned: 0,
    available: 0,
    error: 0,
  },
  bmcReachable: 0,
  bmcUnreachable: 0,
  health: 'healthy',
  lastUpdated: new Date().toISOString(),
}

/**
 * BareMetalHost shape returned by the console backend at
 * GET /api/proxy/metal3/hosts.
 *
 * The backend queries the metal3.io/v1alpha1 BareMetalHost CRD across all
 * connected clusters via the dynamic Kubernetes client and returns a flat
 * list. Only the fields consumed here are typed; all other fields are ignored.
 *
 * provisioning.state reflects the BareMetalHost .status.provisioning.state
 * field, which can be: provisioned, provisioning, deprovisioning,
 * deprovisioned, available, ready, inspecting, matching, registering,
 * cleaning, deleting, or externally provisioned.
 *
 * bmc.address is the BMC endpoint and bmc.credentialsName indicates
 * whether credentials are configured. The reachable flag is derived from
 * the "BMCAccessError" condition (type=BMCAccessError, status=True → unreachable).
 */
interface BackendBareMetalHost {
  provisioning?: {
    state?: string
  }
  conditions?: Array<{
    type?: string
    status?: string
  }>
}

async function fetchMetal3Status(): Promise<Metal3Status> {
  const resp = await fetch('/api/proxy/metal3/hosts', {
    headers: { Accept: 'application/json' },
  })

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }

  const body: { hosts?: BackendBareMetalHost[] } = await resp.json()
  const items = Array.isArray(body?.hosts) ? body.hosts : []

  const states = {
    provisioned: 0,
    provisioning: 0,
    deprovisioned: 0,
    available: 0,
    error: 0,
  }

  let bmcReachable = 0
  let bmcUnreachable = 0

  for (const host of items) {
    const state = host.provisioning?.state ?? ''

    // Normalise the many Metal3 states into the 5 display buckets
    if (state === 'provisioned' || state === 'externally provisioned') {
      states.provisioned++
    } else if (
      state === 'provisioning' ||
      state === 'deprovisioning' ||
      state === 'inspecting' ||
      state === 'matching' ||
      state === 'registering' ||
      state === 'cleaning'
    ) {
      states.provisioning++
    } else if (state === 'deprovisioned' || state === 'deleting') {
      states.deprovisioned++
    } else if (state === 'available' || state === 'ready') {
      states.available++
    } else {
      // Covers "error", empty/unknown, and any future states
      states.error++
    }

    // BMC reachability: BMCAccessError condition type=True → unreachable
    const hasBMCError = host.conditions?.some(
      (c) => c.type === 'BMCAccessError' && c.status === 'True',
    )
    if (hasBMCError) {
      bmcUnreachable++
    } else {
      bmcReachable++
    }
  }

  const health: 'healthy' | 'degraded' =
    bmcUnreachable === 0 && states.provisioning === 0 && states.error === 0
      ? 'healthy'
      : 'degraded'

  return {
    totalHosts: items.length,
    provisioningStates: states,
    bmcReachable,
    bmcUnreachable,
    health,
    lastUpdated: new Date().toISOString(),
  }
}

function toDemoStatus(demo: Metal3DemoData): Metal3Status {
  return {
    totalHosts: demo.totalHosts,
    provisioningStates: { ...demo.provisioningStates },
    bmcReachable: demo.bmcReachable,
    bmcUnreachable: demo.bmcUnreachable,
    health: demo.health,
    lastUpdated: demo.lastUpdated,
  }
}

export interface UseMetal3StatusResult {
  data: Metal3Status
  loading: boolean
  /** True when 3+ consecutive fetch failures and no cached data. */
  error: boolean
  /** True when loading AND no cached data (show skeleton). */
  showSkeleton: boolean
  /** True when loading finished but totalHosts is still 0 (show empty state). */
  showEmptyState: boolean
  /** Number of consecutive fetch failures. */
  consecutiveFailures: number
}

export function useMetal3Status(): UseMetal3StatusResult {
  const { data, isLoading, isFailed, consecutiveFailures, isDemoFallback } =
    useCache<Metal3Status>({
      key: CACHE_KEY,
      category: 'default',
      initialData: INITIAL_DATA,
      demoData: toDemoStatus(METAL3_DEMO_DATA),
      persist: true,
      fetcher: fetchMetal3Status,
    })

  const hasAnyData = data.totalHosts > 0

  const { showSkeleton, showEmptyState } = useCardLoadingState({
    isLoading,
    hasAnyData,
    isFailed,
    consecutiveFailures,
    isDemoData: isDemoFallback,
  })

  return {
    data,
    loading: isLoading,
    error: isFailed && !hasAnyData,
    showSkeleton,
    showEmptyState,
    consecutiveFailures,
  }
}
