import { useCache } from '../../../lib/cache'
import { useCardLoadingState } from '../CardDataContext'
import { ARTIFACT_HUB_DEMO_DATA, type ArtifactHubDemoData } from './demoData'

export interface ArtifactHubStatus {
  repositoryCount: number
  packageCount: number
  health: 'healthy' | 'degraded'
  lastSyncTime: string
}

/**
 * Artifact Hub API response shapes (for reference):
 *
 * GET /api/v1/repositories/search
 *   → { items: Repository[], pagination: { limit, offset, total } }
 *
 * GET /api/v1/packages/search
 *   → { packages: Package[], pagination: { limit, offset, total } }
 *
 * Both endpoints always wrap results — we must read `pagination.total`
 * (or the respective `items`/`packages` array length) rather than treating
 * the whole response as an array.
 *
 * Requests are routed through the console backend (/api/proxy/artifact-hub/stats)
 * to avoid CORS restrictions in the browser. The backend handler caches results
 * for 5 minutes and proxies to the public Artifact Hub API server-side.
 * This matches the pattern used by other external-API cards (e.g. NightlyE2E).
 */

const CACHE_KEY = 'artifact-hub-status'

const INITIAL_DATA: ArtifactHubStatus = {
  repositoryCount: 0,
  packageCount: 0,
  health: 'healthy',
  lastSyncTime: new Date().toISOString(),
}

async function fetchArtifactHubStatus(): Promise<ArtifactHubStatus> {
  const resp = await fetch('/api/proxy/artifact-hub/stats', {
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }
  return resp.json() as Promise<ArtifactHubStatus>
}

function toDemoStatus(demo: ArtifactHubDemoData): ArtifactHubStatus {
  return {
    repositoryCount: demo.repositoryCount,
    packageCount: demo.packageCount,
    health: demo.health,
    lastSyncTime: demo.lastSyncTime,
  }
}

export interface UseArtifactHubStatusResult {
  data: ArtifactHubStatus
  loading: boolean
  /** True when the fetch has failed and there is no cached data. */
  error: boolean
  /** True when loading AND there is no cached data (show skeleton). */
  showSkeleton: boolean
  /** True when loading finished but both counts are still 0 (show empty state). */
  showEmptyState: boolean
  /** Number of consecutive fetch failures — used for degraded state detection. */
  consecutiveFailures: number
}

export function useArtifactHubStatus(): UseArtifactHubStatusResult {
  const { data, isLoading, isFailed, consecutiveFailures, isDemoFallback } =
    useCache<ArtifactHubStatus>({
      key: CACHE_KEY,
      category: 'default',
      initialData: INITIAL_DATA,
      demoData: toDemoStatus(ARTIFACT_HUB_DEMO_DATA),
      persist: true,
      fetcher: fetchArtifactHubStatus,
    })

  const hasAnyData = data.repositoryCount > 0 || data.packageCount > 0

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
    // Only surface an error when the cache itself has fully failed (no data at all)
    error: isFailed && !hasAnyData,
    showSkeleton,
    showEmptyState,
    consecutiveFailures,
  }
}
