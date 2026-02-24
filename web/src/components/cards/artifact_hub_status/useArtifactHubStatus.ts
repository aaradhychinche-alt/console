import { useCache } from '../../../lib/cache'
import { useCardLoadingState } from '../CardDataContext'
import { ARTIFACT_HUB_DEMO_DATA, type ArtifactHubDemoData } from './demoData'

export interface ArtifactHubStatus {
  repositoryCount: number
  packageCount: number
  health: 'healthy' | 'degraded'
  /** ISO 8601 timestamp of when the backend last checked Artifact Hub. */
  lastCheckedAt: string
}

/**
 * Artifact Hub API response notes:
 *
 * GET /api/v1/repositories/search  → bare JSON array of Repository objects
 * GET /api/v1/packages/search      → { "packages": [...] }
 *
 * Neither endpoint includes a pagination wrapper in the body.
 * Total counts are returned in the `Pagination-Total-Count` HTTP response header.
 * The backend reads that header and returns the aggregated counts so the
 * browser never has to hit the Artifact Hub API directly (avoids CORS).
 */

const CACHE_KEY = 'artifact-hub-status'

const INITIAL_DATA: ArtifactHubStatus = {
  repositoryCount: 0,
  packageCount: 0,
  health: 'healthy',
  lastCheckedAt: new Date().toISOString(),
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
    lastCheckedAt: demo.lastSyncTime,
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
