import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { reportAgentDataError, reportAgentDataSuccess } from './useLocalAgent'

// Refresh interval for automatic polling (2 minutes) - manual refresh bypasses this
const REFRESH_INTERVAL_MS = 120000

// Types matching the backend MCP bridge
export interface ClusterInfo {
  name: string
  context: string
  server?: string
  user?: string
  healthy: boolean
  source?: string
  nodeCount?: number
  podCount?: number
  cpuCores?: number
  // Memory metrics
  memoryBytes?: number
  memoryGB?: number
  // Storage metrics
  storageBytes?: number
  storageGB?: number
  // PVC metrics
  pvcCount?: number
  pvcBoundCount?: number
  isCurrent?: boolean
  // Reachability fields (from health check)
  reachable?: boolean
  lastSeen?: string
  errorType?: 'timeout' | 'auth' | 'network' | 'certificate' | 'unknown'
  errorMessage?: string
  // Refresh state - true when a refresh is in progress for this cluster
  refreshing?: boolean
}

export interface ClusterHealth {
  cluster: string
  healthy: boolean
  apiServer?: string
  nodeCount: number
  readyNodes: number
  podCount?: number
  cpuCores?: number
  // Memory metrics
  memoryBytes?: number
  memoryGB?: number
  // Storage metrics
  storageBytes?: number
  storageGB?: number
  // PVC metrics
  pvcCount?: number
  pvcBoundCount?: number
  issues?: string[]
  // Fields for reachability
  reachable?: boolean
  lastSeen?: string
  errorType?: 'timeout' | 'auth' | 'network' | 'certificate' | 'unknown'
  errorMessage?: string
}

export interface ContainerInfo {
  name: string
  image: string
  ready: boolean
  state: 'running' | 'waiting' | 'terminated'
  reason?: string
  message?: string
}

export interface PodInfo {
  name: string
  namespace: string
  cluster?: string
  status: string
  ready: string
  restarts: number
  age: string
  node?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  containers?: ContainerInfo[]
}

export interface PodIssue {
  name: string
  namespace: string
  cluster?: string
  status: string
  reason?: string
  issues: string[]
  restarts: number
}

export interface ClusterEvent {
  type: string
  reason: string
  message: string
  object: string
  namespace: string
  cluster?: string
  count: number
  firstSeen?: string
  lastSeen?: string
}

export interface DeploymentIssue {
  name: string
  namespace: string
  cluster?: string
  replicas: number
  readyReplicas: number
  reason?: string
  message?: string
}

export interface Deployment {
  name: string
  namespace: string
  cluster?: string
  status: 'running' | 'deploying' | 'failed'
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  progress: number
  image?: string
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface GPUNode {
  name: string
  cluster: string
  gpuType: string
  gpuCount: number
  gpuAllocated: number
}

export interface NodeCondition {
  type: string
  status: string
  reason?: string
  message?: string
}

export interface NodeInfo {
  name: string
  cluster?: string
  status: string // Ready, NotReady, Unknown
  roles: string[]
  internalIP?: string
  externalIP?: string
  kubeletVersion: string
  containerRuntime?: string
  os?: string
  architecture?: string
  cpuCapacity: string
  memoryCapacity: string
  storageCapacity?: string
  podCapacity: string
  conditions: NodeCondition[]
  labels?: Record<string, string>
  taints?: string[]
  age?: string
  unschedulable: boolean
}

export interface Service {
  name: string
  namespace: string
  cluster?: string
  type: string // ClusterIP, NodePort, LoadBalancer, ExternalName
  clusterIP?: string
  externalIP?: string
  ports?: string[]
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface Job {
  name: string
  namespace: string
  cluster?: string
  status: string // Running, Complete, Failed
  completions: string
  duration?: string
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface HPA {
  name: string
  namespace: string
  cluster?: string
  reference: string
  minReplicas: number
  maxReplicas: number
  currentReplicas: number
  targetCPU?: string
  currentCPU?: string
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface ConfigMap {
  name: string
  namespace: string
  cluster?: string
  dataCount: number
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface Secret {
  name: string
  namespace: string
  cluster?: string
  type: string
  dataCount: number
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface ServiceAccount {
  name: string
  namespace: string
  cluster?: string
  secrets?: string[]
  imagePullSecrets?: string[]
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface PVC {
  name: string
  namespace: string
  cluster?: string
  status: string
  storageClass?: string
  capacity?: string
  accessModes?: string[]
  volumeName?: string
  age?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface MCPStatus {
  opsClient: {
    available: boolean
    toolCount: number
  }
  deployClient: {
    available: boolean
    toolCount: number
  }
}

// Hook to get MCP status
export function useMCPStatus() {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get<MCPStatus>('/api/mcp/status')
        setStatus(data)
        setError(null)
      } catch (err) {
        setError('MCP bridge not available')
        setStatus(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
    // Poll every 2 minutes
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return { status, isLoading, error }
}

// Local agent URL for direct cluster access
const LOCAL_AGENT_URL = 'http://127.0.0.1:8585'

// ============================================================================
// Shared Cluster State - ensures all useClusters() consumers see the same data
// ============================================================================
interface ClusterCache {
  clusters: ClusterInfo[]
  lastUpdated: Date | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
}

// Module-level shared state
let clusterCache: ClusterCache = {
  clusters: [],
  lastUpdated: null,
  isLoading: true,
  isRefreshing: false,
  error: null,
}

// Subscribers that get notified when cluster data changes
type ClusterSubscriber = (cache: ClusterCache) => void
const clusterSubscribers = new Set<ClusterSubscriber>()

// Notify all subscribers of state change
function notifyClusterSubscribers() {
  clusterSubscribers.forEach(subscriber => subscriber(clusterCache))
}

// Debounced notification for batching rapid updates (prevents flashing during health checks)
let notifyTimeout: ReturnType<typeof setTimeout> | null = null
function notifyClusterSubscribersDebounced() {
  if (notifyTimeout) {
    clearTimeout(notifyTimeout)
  }
  notifyTimeout = setTimeout(() => {
    notifyClusterSubscribers()
    notifyTimeout = null
  }, 50) // 50ms debounce batches rapid health check completions
}

// Update shared cluster cache
function updateClusterCache(updates: Partial<ClusterCache>) {
  clusterCache = { ...clusterCache, ...updates }
  notifyClusterSubscribers()
}

// Update a single cluster in the shared cache (debounced to prevent flashing)
function updateSingleClusterInCache(clusterName: string, updates: Partial<ClusterInfo>) {
  clusterCache = {
    ...clusterCache,
    clusters: clusterCache.clusters.map(c =>
      c.name === clusterName ? { ...c, ...updates } : c
    ),
  }
  // Use debounced notification to batch multiple cluster updates
  notifyClusterSubscribersDebounced()
}

// Track if initial fetch has been triggered (to avoid duplicate fetches)
let initialFetchStarted = false

// Reset shared state on HMR (hot module reload) in development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    initialFetchStarted = false
    clusterCache = {
      clusters: [],
      lastUpdated: null,
      isLoading: true,
      isRefreshing: false,
      error: null,
    }
    clusterSubscribers.clear()
  })
}

// Fetch basic cluster list from local agent (fast, no health check)
async function fetchClusterListFromAgent(): Promise<ClusterInfo[] | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(`${LOCAL_AGENT_URL}/clusters`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (response.ok) {
      const data = await response.json()
      // Report successful data fetch - can recover from degraded state
      reportAgentDataSuccess()
      // Transform agent response to ClusterInfo format - mark as "checking" initially
      return (data.clusters || []).map((c: any) => ({
        name: c.name,
        context: c.context || c.name,
        server: c.server,
        user: c.user,
        healthy: true, // Will be updated by health check
        reachable: undefined, // Unknown until health check completes
        source: 'kubeconfig',
        nodeCount: undefined, // undefined = still checking, 0 = unreachable
        podCount: undefined,
        isCurrent: c.isCurrent,
      }))
    } else {
      // Non-OK response (e.g., 503 Service Unavailable)
      reportAgentDataError('/clusters', `HTTP ${response.status}`)
    }
  } catch (err) {
    // Local agent not available or timeout
    // Note: We don't report this as a data error because if the agent
    // is completely unavailable, the health check will catch it
  }
  return null
}

// Fetch health for a single cluster from backend (with short timeout for progressive loading)
async function fetchSingleClusterHealth(clusterName: string): Promise<ClusterHealth | null> {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `/api/mcp/clusters/${encodeURIComponent(clusterName)}/health`,
      {
        signal: AbortSignal.timeout(10000), // 10 second timeout per cluster (increased for slow networks)
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      }
    )
    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Timeout or error - cluster is likely unreachable
  }
  return null
}

// Progressive health check - fetches health for each cluster individually
// Updates shared cache so all consumers see the same data
async function checkHealthProgressively(clusterList: ClusterInfo[]) {
  // Fire off all health checks in parallel - each updates shared cache when done
  clusterList.forEach(async (cluster) => {
    const health = await fetchSingleClusterHealth(cluster.name)

    if (health) {
      // Health data available - cluster is reachable if we got a response
      // Only mark unreachable if explicitly set to false by backend
      const isReachable = health.reachable !== false
      updateSingleClusterInCache(cluster.name, {
        healthy: health.healthy,
        reachable: isReachable,
        nodeCount: health.nodeCount,
        podCount: health.podCount,
        cpuCores: health.cpuCores,
        // Memory/storage metrics
        memoryBytes: health.memoryBytes,
        memoryGB: health.memoryGB,
        storageBytes: health.storageBytes,
        storageGB: health.storageGB,
        pvcCount: health.pvcCount,
        pvcBoundCount: health.pvcBoundCount,
        errorType: health.errorType,
        errorMessage: health.errorMessage,
        refreshing: false,
      })
    } else {
      // No health data or timeout - cluster is unreachable
      updateSingleClusterInCache(cluster.name, {
        healthy: false,
        reachable: false,
        nodeCount: 0,
        podCount: 0,
        errorType: 'timeout',
        refreshing: false,
      })
    }
  })
}

// Silent fetch - updates shared cache without showing loading state
async function silentFetchClusters() {
  try {
    // Try local agent first - get cluster list quickly
    const agentClusters = await fetchClusterListFromAgent()
    if (agentClusters) {
      updateClusterCache({
        clusters: agentClusters,
        error: null,
        lastUpdated: new Date(),
      })
      // Check health progressively (non-blocking)
      checkHealthProgressively(agentClusters)
      return
    }
    // Fall back to backend API
    const { data } = await api.get<{ clusters: ClusterInfo[] }>('/api/mcp/clusters')
    updateClusterCache({
      clusters: data.clusters || [],
      error: null,
      lastUpdated: new Date(),
    })
  } catch (err) {
    // On silent fetch, don't replace with demo data - keep existing
    console.error('Silent fetch failed:', err)
  }
}

// Track if a fetch is in progress to prevent duplicate requests
let fetchInProgress = false

// Full refetch - updates shared cache with loading state
// Deduplicates concurrent calls - only one fetch runs at a time
async function fullFetchClusters() {
  // If a fetch is already in progress, skip this call (deduplication)
  if (fetchInProgress) {
    return
  }
  fetchInProgress = true

  // If we have cached data, show refreshing; otherwise show loading
  const hasCachedData = clusterCache.clusters.length > 0
  const startTime = Date.now()

  if (hasCachedData) {
    updateClusterCache({ isRefreshing: true })
  } else {
    updateClusterCache({ isLoading: true })
  }

  // Helper to ensure minimum visible duration for refresh animation
  const finishWithMinDuration = async (updates: Partial<typeof clusterCache>) => {
    const elapsed = Date.now() - startTime
    const minDuration = hasCachedData ? 400 : 0 // Only delay when refreshing, not initial load
    if (elapsed < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsed))
    }
    updateClusterCache(updates)
  }

  try {
    // Try local agent first - get cluster list quickly
    const agentClusters = await fetchClusterListFromAgent()
    if (agentClusters) {
      // Merge new cluster list with existing cached health data (preserve stats during refresh)
      const existingClusters = clusterCache.clusters
      const mergedClusters = agentClusters.map(newCluster => {
        const existing = existingClusters.find(c => c.name === newCluster.name)
        if (existing && existing.nodeCount !== undefined) {
          // Preserve existing health data during silent background refresh (no visual indicator)
          return {
            ...newCluster,
            nodeCount: existing.nodeCount,
            podCount: existing.podCount,
            cpuCores: existing.cpuCores,
            memoryGB: existing.memoryGB,
            storageGB: existing.storageGB,
            healthy: existing.healthy,
            reachable: existing.reachable,
            refreshing: false, // Keep false during background polling - no visual indicator
          }
        }
        return newCluster
      })
      // Show clusters immediately with preserved health data
      await finishWithMinDuration({
        clusters: mergedClusters,
        error: null,
        lastUpdated: new Date(),
        isLoading: false,
        isRefreshing: false,
      })
      // Reset flag before returning - allows subsequent refresh calls
      fetchInProgress = false
      // Check health progressively (non-blocking) - will update each cluster's data
      checkHealthProgressively(agentClusters)
      return
    }
    // Fall back to backend API
    const { data } = await api.get<{ clusters: ClusterInfo[] }>('/api/mcp/clusters')
    await finishWithMinDuration({
      clusters: data.clusters || [],
      error: null,
      lastUpdated: new Date(),
      isLoading: false,
      isRefreshing: false,
    })
    fetchInProgress = false
  } catch (err) {
    await finishWithMinDuration({
      error: 'Failed to fetch clusters',
      clusters: getDemoClusters(),
      isLoading: false,
      isRefreshing: false,
    })
    fetchInProgress = false
  }
}

// Refresh health for a single cluster (exported for use in components)
// Keeps cached values visible while refreshing - only updates surgically when new data is available
export async function refreshSingleCluster(clusterName: string): Promise<void> {
  // Mark the cluster as refreshing immediately (no debounce - user needs to see the spinner)
  clusterCache = {
    ...clusterCache,
    clusters: clusterCache.clusters.map(c =>
      c.name === clusterName ? { ...c, refreshing: true } : c
    ),
  }
  notifyClusterSubscribers() // Immediate notification for user feedback

  const health = await fetchSingleClusterHealth(clusterName)

  if (health) {
    // Health data available - cluster is reachable if we got a response
    // Only mark unreachable if explicitly set to false by backend
    const isReachable = health.reachable !== false
    updateSingleClusterInCache(clusterName, {
      healthy: health.healthy,
      reachable: isReachable,
      nodeCount: health.nodeCount,
      podCount: health.podCount,
      cpuCores: health.cpuCores,
      // Memory/storage metrics
      memoryBytes: health.memoryBytes,
      memoryGB: health.memoryGB,
      storageBytes: health.storageBytes,
      storageGB: health.storageGB,
      pvcCount: health.pvcCount,
      pvcBoundCount: health.pvcBoundCount,
      errorType: health.errorType,
      errorMessage: health.errorMessage,
      refreshing: false,
    })
  } else {
    // No health data or timeout - cluster is unreachable
    // Keep existing cached values for nodes/pods/cpus, just update reachability status
    updateSingleClusterInCache(clusterName, {
      healthy: false,
      reachable: false,
      errorType: 'timeout',
      refreshing: false,
    })
  }
}

// Hook to list clusters with WebSocket support for real-time updates
// Uses shared state so all consumers see the same data
// Uses progressive loading - shows clusters immediately, then updates health individually
export function useClusters() {
  // Local state that syncs with shared cache
  const [localState, setLocalState] = useState<ClusterCache>(clusterCache)

  // Subscribe to shared cache updates
  useEffect(() => {
    // Set initial state from cache
    setLocalState(clusterCache)

    // Subscribe to updates
    const handleUpdate = (cache: ClusterCache) => {
      setLocalState(cache)
    }
    clusterSubscribers.add(handleUpdate)

    return () => {
      clusterSubscribers.delete(handleUpdate)
    }
  }, [])

  // Trigger initial fetch only once (shared across all hook instances)
  useEffect(() => {
    if (!initialFetchStarted) {
      initialFetchStarted = true
      fullFetchClusters()

      // Connect to WebSocket for real-time kubeconfig change notifications
      // Only attempt WebSocket on localhost (dev mode) - deployed versions don't have a backend
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!isLocalhost) {
        return
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//localhost:8080/ws`
      let ws: WebSocket | null = null

      const connect = () => {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('WebSocket connected for cluster updates')
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'kubeconfig_changed') {
              console.log('Kubeconfig changed, updating clusters...')
              silentFetchClusters()
            }
          } catch (e) {
            // Ignore non-JSON messages
          }
        }

        ws.onclose = () => {
          console.log('WebSocket disconnected, reconnecting in 5s...')
          setTimeout(connect, 5000)
        }

        ws.onerror = (err) => {
          console.error('WebSocket error:', err)
          ws?.close()
        }
      }

      connect()

      // Note: We intentionally don't clean up WebSocket here
      // because we want to keep the connection alive for the entire app session
    }
  }, [])

  // Refetch function that consumers can call
  const refetch = useCallback(() => {
    fullFetchClusters()
  }, [])

  return {
    clusters: localState.clusters,
    isLoading: localState.isLoading,
    isRefreshing: localState.isRefreshing,
    lastUpdated: localState.lastUpdated,
    error: localState.error,
    refetch,
  }
}

// Hook to get cluster health
export function useClusterHealth(cluster?: string) {
  const [health, setHealth] = useState<ClusterHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = cluster ? `/api/mcp/clusters/${cluster}/health` : '/api/mcp/clusters/health'
      const { data } = await api.get<ClusterHealth>(url)
      setHealth(data)
      setError(null)
    } catch (err) {
      setError('Failed to fetch cluster health')
      setHealth(getDemoHealth(cluster))
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { health, isLoading, error, refetch }
}

// Hook to get pods
export function usePods(cluster?: string, namespace?: string, sortBy: 'restarts' | 'name' = 'restarts', limit = 10) {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ pods: PodInfo[] }>(`/api/mcp/pods?${params}`)
      let sortedPods = data.pods || []

      // Sort by restarts (descending) or name
      if (sortBy === 'restarts') {
        sortedPods = sortedPods.sort((a, b) => b.restarts - a.restarts)
      } else {
        sortedPods = sortedPods.sort((a, b) => a.name.localeCompare(b.name))
      }

      // Limit results
      setPods(sortedPods.slice(0, limit))
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      // Keep existing data on silent refresh (stale-while-revalidate)
      if (!silent) {
        setError('Failed to fetch pods')
        setPods(getDemoPods())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, sortBy, limit])

  useEffect(() => {
    refetch(false)
    // Poll every 30 seconds for pod updates
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch])

  return { pods, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Module-level cache for pod issues data (persists across navigation)
interface PodIssuesCache {
  data: PodIssue[]
  timestamp: Date
  key: string
}
let podIssuesCache: PodIssuesCache | null = null

// Hook to get pod issues
export function usePodIssues(cluster?: string, namespace?: string) {
  const cacheKey = `podIssues:${cluster || 'all'}:${namespace || 'all'}`

  // Initialize from cache if available
  const getCachedData = () => {
    if (podIssuesCache && podIssuesCache.key === cacheKey) {
      return { data: podIssuesCache.data, timestamp: podIssuesCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [issues, setIssues] = useState<PodIssue[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      const hasCachedData = podIssuesCache && podIssuesCache.key === cacheKey
      if (!hasCachedData) {
        setIsLoading(true)
      }
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ issues: PodIssue[] }>(`/api/mcp/pod-issues?${params}`)
      const newData = data.issues || []
      const now = new Date()

      // Update module-level cache
      podIssuesCache = { data: newData, timestamp: now, key: cacheKey }

      setIssues(newData)
      setError(null)
      setLastUpdated(now)
    } catch (err) {
      // Keep stale data, only use demo if no cached data
      if (!silent && !podIssuesCache) {
        setError('Failed to fetch pod issues')
        setIssues(getDemoPodIssues())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, cacheKey])

  useEffect(() => {
    const hasCachedData = podIssuesCache && podIssuesCache.key === cacheKey
    refetch(!hasCachedData)
    // Poll every 30 seconds for pod issue updates
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { issues, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Hook to get events
// Module-level cache for events data (persists across navigation)
interface EventsCache {
  data: ClusterEvent[]
  timestamp: Date
  key: string
}
let eventsCache: EventsCache | null = null

export function useEvents(cluster?: string, namespace?: string, limit = 20) {
  const cacheKey = `events:${cluster || 'all'}:${namespace || 'all'}:${limit}`

  // Initialize from cache if available
  const getCachedData = () => {
    if (eventsCache && eventsCache.key === cacheKey) {
      return { data: eventsCache.data, timestamp: eventsCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [events, setEvents] = useState<ClusterEvent[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      const hasCachedData = eventsCache && eventsCache.key === cacheKey
      if (!hasCachedData) {
        setIsLoading(true)
      }
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      params.append('limit', limit.toString())
      const { data } = await api.get<{ events: ClusterEvent[] }>(`/api/mcp/events?${params}`)
      const newData = data.events || []
      const now = new Date()

      // Update module-level cache
      eventsCache = { data: newData, timestamp: now, key: cacheKey }

      setEvents(newData)
      setError(null)
      setLastUpdated(now)
    } catch (err) {
      // Keep stale data, only use demo if no cached data
      if (!silent && !eventsCache) {
        setError('Failed to fetch events')
        setEvents(getDemoEvents())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, limit, cacheKey])

  useEffect(() => {
    const hasCachedData = eventsCache && eventsCache.key === cacheKey
    refetch(!hasCachedData)
    // Poll every 30 seconds for events
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { events, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Module-level cache for deployment issues data (persists across navigation)
interface DeploymentIssuesCache {
  data: DeploymentIssue[]
  timestamp: Date
  key: string
}
let deploymentIssuesCache: DeploymentIssuesCache | null = null

// Hook to get deployment issues
export function useDeploymentIssues(cluster?: string, namespace?: string) {
  const cacheKey = `deploymentIssues:${cluster || 'all'}:${namespace || 'all'}`

  // Initialize from cache if available
  const getCachedData = () => {
    if (deploymentIssuesCache && deploymentIssuesCache.key === cacheKey) {
      return { data: deploymentIssuesCache.data, timestamp: deploymentIssuesCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [issues, setIssues] = useState<DeploymentIssue[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      const hasCachedData = deploymentIssuesCache && deploymentIssuesCache.key === cacheKey
      if (!hasCachedData) {
        setIsLoading(true)
      }
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ issues: DeploymentIssue[] }>(`/api/mcp/deployment-issues?${params}`)
      const newData = data.issues || []
      const now = new Date()

      // Update module-level cache
      deploymentIssuesCache = { data: newData, timestamp: now, key: cacheKey }

      setIssues(newData)
      setError(null)
      setLastUpdated(now)
    } catch (err) {
      // Keep stale data, only use demo if no cached data
      if (!silent && !deploymentIssuesCache) {
        setError('Failed to fetch deployment issues')
        setIssues(getDemoDeploymentIssues())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, cacheKey])

  useEffect(() => {
    const hasCachedData = deploymentIssuesCache && deploymentIssuesCache.key === cacheKey
    refetch(!hasCachedData)
    // Poll every 30 seconds for deployment issues
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { issues, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Module-level cache for deployments data (persists across navigation)
interface DeploymentsCache {
  data: Deployment[]
  timestamp: Date
  key: string
}
let deploymentsCache: DeploymentsCache | null = null

// Hook to get deployments with rollout status
export function useDeployments(cluster?: string, namespace?: string) {
  const cacheKey = `deployments:${cluster || 'all'}:${namespace || 'all'}`

  // Initialize from cache if available and matches current key
  const getCachedData = () => {
    if (deploymentsCache && deploymentsCache.key === cacheKey) {
      return { data: deploymentsCache.data, timestamp: deploymentsCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [deployments, setDeployments] = useState<Deployment[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent && (!deploymentsCache || deploymentsCache.key !== cacheKey)) {
      // Only show loading if no cache
      setIsLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ deployments: Deployment[] }>(`/api/mcp/deployments?${params}`)
      const newDeployments = data.deployments || []
      setDeployments(newDeployments)
      setError(null)
      const now = new Date()
      setLastUpdated(now)
      // Update cache
      deploymentsCache = { data: newDeployments, timestamp: now, key: cacheKey }
    } catch (err) {
      // Only set demo data if no cache exists
      if (!silent && !deploymentsCache) {
        setError('Failed to fetch deployments')
        setDeployments(getDemoDeployments())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, cacheKey])

  useEffect(() => {
    // If we have cached data, do a silent refresh
    const hasCachedData = deploymentsCache && deploymentsCache.key === cacheKey
    refetch(hasCachedData ? true : false)
    // Poll every 30 seconds for deployment updates
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { deployments, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Module-level cache for services data (persists across navigation)
interface ServicesCache {
  data: Service[]
  timestamp: Date
  key: string
}
let servicesCache: ServicesCache | null = null

// Hook to get services
export function useServices(cluster?: string, namespace?: string) {
  const cacheKey = `services:${cluster || 'all'}:${namespace || 'all'}`

  // Initialize from cache if available and matches current key
  const getCachedData = () => {
    if (servicesCache && servicesCache.key === cacheKey) {
      return { data: servicesCache.data, timestamp: servicesCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [services, setServices] = useState<Service[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      // Only show loading if we have no data
      const hasCachedData = servicesCache && servicesCache.key === cacheKey
      if (!hasCachedData) {
        setIsLoading(true)
      }
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ services: Service[] }>(`/api/mcp/services?${params}`)
      const newData = data.services || []
      const now = new Date()

      // Update module-level cache
      servicesCache = { data: newData, timestamp: now, key: cacheKey }

      setServices(newData)
      setError(null)
      setLastUpdated(now)
    } catch (err) {
      if (!silent) {
        setError('Failed to fetch services')
      }
      // Don't clear services on error - keep stale data
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, cacheKey])

  useEffect(() => {
    // If we have cached data, still refresh in background but don't show loading
    const hasCachedData = servicesCache && servicesCache.key === cacheKey
    refetch(!hasCachedData) // silent=true if we have cached data

    // Poll every 30 seconds for service updates
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { services, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Hook to get jobs
export function useJobs(cluster?: string, namespace?: string) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ jobs: Job[] }>(`/api/mcp/jobs?${params}`)
      setJobs(data.jobs || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch jobs')
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { jobs, isLoading, error, refetch }
}

// Hook to get HPAs
export function useHPAs(cluster?: string, namespace?: string) {
  const [hpas, setHPAs] = useState<HPA[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ hpas: HPA[] }>(`/api/mcp/hpas?${params}`)
      setHPAs(data.hpas || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch HPAs')
      setHPAs([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { hpas, isLoading, error, refetch }
}

// Hook to get ConfigMaps
export function useConfigMaps(cluster?: string, namespace?: string) {
  const [configmaps, setConfigMaps] = useState<ConfigMap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ configmaps: ConfigMap[] }>(`/api/mcp/configmaps?${params}`)
      setConfigMaps(data.configmaps || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch ConfigMaps')
      setConfigMaps([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { configmaps, isLoading, error, refetch }
}

// Hook to get Secrets
export function useSecrets(cluster?: string, namespace?: string) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ secrets: Secret[] }>(`/api/mcp/secrets?${params}`)
      setSecrets(data.secrets || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch Secrets')
      setSecrets([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { secrets, isLoading, error, refetch }
}

// Hook to get service accounts
export function useServiceAccounts(cluster?: string, namespace?: string) {
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ serviceAccounts: ServiceAccount[] }>(`/api/mcp/serviceaccounts?${params}`)
      setServiceAccounts(data.serviceAccounts || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch ServiceAccounts')
      setServiceAccounts([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { serviceAccounts, isLoading, error, refetch }
}

// Hook to get PVCs
export function usePVCs(cluster?: string, namespace?: string) {
  const [pvcs, setPVCs] = useState<PVC[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ pvcs: PVC[] }>(`/api/mcp/pvcs?${params}`)
      setPVCs(data.pvcs || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch PVCs')
      setPVCs([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { pvcs, isLoading, error, refetch }
}

// Hook to get pod logs
export function usePodLogs(cluster: string, namespace: string, pod: string, container?: string, tail = 100) {
  const [logs, setLogs] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!cluster || !namespace || !pod) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('cluster', cluster)
      params.append('namespace', namespace)
      params.append('pod', pod)
      if (container) params.append('container', container)
      params.append('tail', tail.toString())
      const { data } = await api.get<{ logs: string }>(`/api/mcp/pods/logs?${params}`)
      setLogs(data.logs || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      setLogs('')
    } finally {
      setIsLoading(false)
    }
  }, [cluster, namespace, pod, container, tail])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { logs, isLoading, error, refetch }
}

// Hook to get warning events
// Module-level cache for warning events data (persists across navigation)
interface WarningEventsCache {
  data: ClusterEvent[]
  timestamp: Date
  key: string
}
let warningEventsCache: WarningEventsCache | null = null

export function useWarningEvents(cluster?: string, namespace?: string, limit = 20) {
  const cacheKey = `warningEvents:${cluster || 'all'}:${namespace || 'all'}:${limit}`

  // Initialize from cache if available
  const getCachedData = () => {
    if (warningEventsCache && warningEventsCache.key === cacheKey) {
      return { data: warningEventsCache.data, timestamp: warningEventsCache.timestamp }
    }
    return null
  }

  const cached = getCachedData()
  const [events, setEvents] = useState<ClusterEvent[]>(cached?.data || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached?.timestamp || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      const hasCachedData = warningEventsCache && warningEventsCache.key === cacheKey
      if (!hasCachedData) {
        setIsLoading(true)
      }
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      params.append('limit', limit.toString())
      const { data } = await api.get<{ events: ClusterEvent[] }>(`/api/mcp/events/warnings?${params}`)
      const newData = data.events || []
      const now = new Date()

      // Update module-level cache
      warningEventsCache = { data: newData, timestamp: now, key: cacheKey }

      setEvents(newData)
      setError(null)
      setLastUpdated(now)
    } catch (err) {
      // Keep stale data, only use demo if no cached data
      if (!silent && !warningEventsCache) {
        setError('Failed to fetch warning events')
        setEvents(getDemoEvents().filter(e => e.type === 'Warning'))
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, limit, cacheKey])

  useEffect(() => {
    const hasCachedData = warningEventsCache && warningEventsCache.key === cacheKey
    refetch(!hasCachedData)
    // Poll every 30 seconds for events
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch, cacheKey])

  return { events, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

// Hook to get GPU nodes
export function useGPUNodes(cluster?: string) {
  const [nodes, setNodes] = useState<GPUNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      const { data } = await api.get<{ nodes: GPUNode[] }>(`/api/mcp/gpu-nodes?${params}`)
      setNodes(data.nodes || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch GPU nodes')
      // Return demo GPU data
      setNodes(getDemoGPUNodes())
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { nodes, isLoading, error, refetch }
}

// Hook to get detailed node information
export function useNodes(cluster?: string) {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      const { data } = await api.get<{ nodes: NodeInfo[] }>(`/api/mcp/nodes?${params}`)
      setNodes(data.nodes || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch nodes')
      setNodes([])
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { nodes, isLoading, error, refetch }
}

// Security issue types
export interface SecurityIssue {
  name: string
  namespace: string
  cluster?: string
  issue: string
  severity: 'high' | 'medium' | 'low'
  details?: string
}

// Hook to get security issues
export function useSecurityIssues(cluster?: string, namespace?: string) {
  const [issues, setIssues] = useState<SecurityIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent && issues.length === 0) {
      setIsLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ issues: SecurityIssue[] }>(`/api/mcp/security-issues?${params}`)
      setIssues(data.issues || [])
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      // Only set demo data if we don't have existing data and not silent
      if (!silent && issues.length === 0) {
        setError('Failed to fetch security issues')
        setIssues(getDemoSecurityIssues())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace, issues.length])

  useEffect(() => {
    refetch()
  }, [cluster, namespace]) // Only refetch on parameter changes, not on refetch function change

  return { issues, isLoading, isRefreshing, lastUpdated, error, refetch }
}

// GitOps drift types
export interface GitOpsDrift {
  resource: string
  namespace: string
  cluster: string
  kind: string
  driftType: 'modified' | 'deleted' | 'added'
  gitVersion: string
  details?: string
  severity: 'high' | 'medium' | 'low'
}

// Hook to get GitOps drifts
export function useGitOpsDrifts(cluster?: string, namespace?: string) {
  const [drifts, setDrifts] = useState<GitOpsDrift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (silent = false) => {
    // For silent (background) refreshes, don't update loading states - prevents UI flashing
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (cluster) params.append('cluster', cluster)
      if (namespace) params.append('namespace', namespace)
      const { data } = await api.get<{ drifts: GitOpsDrift[] }>(`/api/gitops/drifts?${params}`)
      setDrifts(data.drifts || [])
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      if (!silent) {
        setError('Failed to fetch GitOps drifts')
        setDrifts(getDemoGitOpsDrifts())
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
      setIsRefreshing(false)
    }
  }, [cluster, namespace])

  useEffect(() => {
    refetch(false)
    // Poll every 30 seconds
    const interval = setInterval(() => refetch(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch])

  return { drifts, isLoading, isRefreshing, lastUpdated, error, refetch: () => refetch(false) }
}

function getDemoGitOpsDrifts(): GitOpsDrift[] {
  return [
    {
      resource: 'api-gateway',
      namespace: 'production',
      cluster: 'prod-east',
      kind: 'Deployment',
      driftType: 'modified',
      gitVersion: 'v2.4.0',
      details: 'Image tag changed from v2.4.0 to v2.4.1-hotfix',
      severity: 'medium',
    },
    {
      resource: 'config-secret',
      namespace: 'production',
      cluster: 'prod-east',
      kind: 'Secret',
      driftType: 'modified',
      gitVersion: 'abc123',
      details: 'Secret data modified manually',
      severity: 'high',
    },
    {
      resource: 'debug-pod',
      namespace: 'default',
      cluster: 'staging',
      kind: 'Pod',
      driftType: 'added',
      gitVersion: '-',
      details: 'Resource exists in cluster but not in Git',
      severity: 'low',
    },
  ]
}

function getDemoSecurityIssues(): SecurityIssue[] {
  return [
    {
      name: 'api-server-7d8f9c6b5-x2k4m',
      namespace: 'production',
      cluster: 'prod-east',
      issue: 'Privileged container',
      severity: 'high',
      details: 'Container running in privileged mode',
    },
    {
      name: 'worker-deployment',
      namespace: 'batch',
      cluster: 'vllm-d',
      issue: 'Running as root',
      severity: 'high',
      details: 'Container running as root user',
    },
    {
      name: 'nginx-ingress',
      namespace: 'ingress',
      cluster: 'prod-east',
      issue: 'Host network enabled',
      severity: 'medium',
      details: 'Pod using host network namespace',
    },
    {
      name: 'monitoring-agent',
      namespace: 'monitoring',
      cluster: 'staging',
      issue: 'Missing security context',
      severity: 'low',
      details: 'No security context defined',
    },
  ]
}

// Demo data fallbacks
function getDemoClusters(): ClusterInfo[] {
  return [
    { name: 'kind-local', context: 'kind-local', healthy: true, source: 'kubeconfig', nodeCount: 1, podCount: 15 },
    { name: 'vllm-d', context: 'vllm-d', healthy: true, source: 'kubeconfig', nodeCount: 8, podCount: 124 },
    { name: 'prod-east', context: 'prod-east', healthy: true, source: 'kubeconfig', nodeCount: 12, podCount: 89 },
    { name: 'staging', context: 'staging', healthy: false, source: 'kubeconfig', nodeCount: 3, podCount: 42 },
  ]
}

function getDemoHealth(cluster?: string): ClusterHealth {
  return {
    cluster: cluster || 'default',
    healthy: true,
    nodeCount: 3,
    readyNodes: 3,
    podCount: 45,
    issues: [],
  }
}

function getDemoPodIssues(): PodIssue[] {
  return [
    {
      name: 'api-server-7d8f9c6b5-x2k4m',
      namespace: 'production',
      cluster: 'prod-east',
      status: 'CrashLoopBackOff',
      reason: 'Error',
      issues: ['Container restarting', 'OOMKilled'],
      restarts: 15,
    },
    {
      name: 'worker-5c6d7e8f9-n3p2q',
      namespace: 'batch',
      cluster: 'vllm-d',
      status: 'ImagePullBackOff',
      reason: 'ImagePullBackOff',
      issues: ['Failed to pull image'],
      restarts: 0,
    },
    {
      name: 'cache-redis-0',
      namespace: 'data',
      cluster: 'staging',
      status: 'Pending',
      reason: 'Unschedulable',
      issues: ['Insufficient memory'],
      restarts: 0,
    },
  ]
}

function getDemoPods(): PodInfo[] {
  return [
    { name: 'api-server-7d8f9c6b5-x2k4m', namespace: 'production', cluster: 'prod-east', status: 'Running', ready: '1/1', restarts: 15, age: '2d', node: 'node-1' },
    { name: 'worker-5c6d7e8f9-n3p2q', namespace: 'batch', cluster: 'vllm-d', status: 'Running', ready: '1/1', restarts: 8, age: '5h', node: 'gpu-node-2' },
    { name: 'cache-redis-0', namespace: 'data', cluster: 'staging', status: 'Running', ready: '1/1', restarts: 5, age: '14d', node: 'node-3' },
    { name: 'frontend-8e9f0a1b2-def34', namespace: 'web', cluster: 'prod-west', status: 'Running', ready: '1/1', restarts: 3, age: '1d', node: 'node-2' },
    { name: 'nginx-ingress-abc123', namespace: 'ingress', cluster: 'prod-east', status: 'Running', ready: '1/1', restarts: 2, age: '7d', node: 'node-1' },
    { name: 'monitoring-agent-xyz', namespace: 'monitoring', cluster: 'staging', status: 'Running', ready: '1/1', restarts: 1, age: '30d', node: 'node-4' },
    { name: 'api-gateway-pod-1', namespace: 'production', cluster: 'prod-east', status: 'Running', ready: '1/1', restarts: 0, age: '3d', node: 'node-2' },
    { name: 'worker-processor-1', namespace: 'batch', cluster: 'vllm-d', status: 'Running', ready: '1/1', restarts: 0, age: '12h', node: 'gpu-node-1' },
    { name: 'database-primary-0', namespace: 'data', cluster: 'staging', status: 'Running', ready: '1/1', restarts: 0, age: '60d', node: 'node-5' },
    { name: 'scheduler-job-xyz', namespace: 'system', cluster: 'prod-east', status: 'Running', ready: '1/1', restarts: 0, age: '4h', node: 'node-1' },
  ]
}

function getDemoDeploymentIssues(): DeploymentIssue[] {
  return [
    {
      name: 'api-gateway',
      namespace: 'production',
      cluster: 'prod-east',
      replicas: 3,
      readyReplicas: 1,
      reason: 'Unavailable',
      message: 'Deployment does not have minimum availability',
    },
    {
      name: 'worker-service',
      namespace: 'batch',
      cluster: 'vllm-d',
      replicas: 5,
      readyReplicas: 3,
      reason: 'Progressing',
      message: 'ReplicaSet is progressing',
    },
  ]
}

function getDemoDeployments(): Deployment[] {
  return [
    {
      name: 'api-gateway',
      namespace: 'production',
      cluster: 'prod-east',
      status: 'running',
      replicas: 3,
      readyReplicas: 3,
      updatedReplicas: 3,
      availableReplicas: 3,
      progress: 100,
      image: 'api-gateway:v2.4.1',
      age: '5d',
    },
    {
      name: 'worker-service',
      namespace: 'batch',
      cluster: 'vllm-d',
      status: 'deploying',
      replicas: 3,
      readyReplicas: 2,
      updatedReplicas: 3,
      availableReplicas: 2,
      progress: 67,
      image: 'worker:v1.8.0',
      age: '2h',
    },
    {
      name: 'frontend',
      namespace: 'web',
      cluster: 'prod-west',
      status: 'failed',
      replicas: 3,
      readyReplicas: 1,
      updatedReplicas: 3,
      availableReplicas: 1,
      progress: 33,
      image: 'frontend:v3.0.0',
      age: '30m',
    },
    {
      name: 'cache-redis',
      namespace: 'data',
      cluster: 'staging',
      status: 'running',
      replicas: 1,
      readyReplicas: 1,
      updatedReplicas: 1,
      availableReplicas: 1,
      progress: 100,
      image: 'redis:7.2.0',
      age: '14d',
    },
  ]
}

function getDemoGPUNodes(): GPUNode[] {
  return [
    { name: 'gpu-node-1', cluster: 'vllm-d', gpuType: 'NVIDIA A100', gpuCount: 8, gpuAllocated: 6 },
    { name: 'gpu-node-2', cluster: 'vllm-d', gpuType: 'NVIDIA A100', gpuCount: 8, gpuAllocated: 8 },
    { name: 'gpu-node-3', cluster: 'vllm-d', gpuType: 'NVIDIA A100', gpuCount: 8, gpuAllocated: 4 },
    { name: 'gpu-worker-1', cluster: 'ops', gpuType: 'NVIDIA V100', gpuCount: 4, gpuAllocated: 2 },
    { name: 'ml-node-1', cluster: 'prod-east', gpuType: 'NVIDIA T4', gpuCount: 2, gpuAllocated: 2 },
  ]
}

// Hook to get namespaces for a cluster (derived from pods)
export function useNamespaces(cluster?: string) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!cluster) {
      setNamespaces([])
      return
    }

    setIsLoading(true)
    try {
      // Fetch pods for the cluster to get namespaces
      const { data } = await api.get<{ pods: PodInfo[] }>(`/api/mcp/pods?cluster=${encodeURIComponent(cluster)}`)
      const nsSet = new Set<string>()
      data.pods?.forEach(pod => {
        if (pod.namespace) nsSet.add(pod.namespace)
      })
      // Sort and set namespaces
      setNamespaces(Array.from(nsSet).sort())
      setError(null)
    } catch (err) {
      setError('Failed to fetch namespaces')
      // Fallback to demo namespaces
      setNamespaces(getDemoNamespaces())
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { namespaces, isLoading, error, refetch }
}

function getDemoNamespaces(): string[] {
  return ['default', 'kube-system', 'kube-public', 'monitoring', 'production', 'staging', 'batch', 'data', 'web', 'ingress']
}

// Namespace stats interface
export interface NamespaceStats {
  name: string
  podCount: number
  runningPods: number
  pendingPods: number
  failedPods: number
}

// Hook to get namespace statistics for a cluster
export function useNamespaceStats(cluster?: string) {
  const [stats, setStats] = useState<NamespaceStats[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!cluster) {
      setStats([])
      return
    }

    setIsLoading(true)
    try {
      // Fetch all pods for the cluster (no limit)
      const { data } = await api.get<{ pods: PodInfo[] }>(`/api/mcp/pods?cluster=${encodeURIComponent(cluster)}&limit=1000`)

      // Group pods by namespace and calculate stats
      const nsMap: Record<string, NamespaceStats> = {}
      data.pods?.forEach(pod => {
        const ns = pod.namespace || 'default'
        if (!nsMap[ns]) {
          nsMap[ns] = { name: ns, podCount: 0, runningPods: 0, pendingPods: 0, failedPods: 0 }
        }
        nsMap[ns].podCount++
        if (pod.status === 'Running') {
          nsMap[ns].runningPods++
        } else if (pod.status === 'Pending') {
          nsMap[ns].pendingPods++
        } else if (pod.status === 'Failed' || pod.status === 'CrashLoopBackOff' || pod.status === 'Error') {
          nsMap[ns].failedPods++
        }
      })

      // Sort by pod count (descending)
      const sortedStats = Object.values(nsMap).sort((a, b) => b.podCount - a.podCount)
      setStats(sortedStats)
      setError(null)
    } catch (err) {
      setError('Failed to fetch namespace stats')
      // Fallback to demo data
      setStats(getDemoNamespaceStats())
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { stats, isLoading, error, refetch }
}

function getDemoNamespaceStats(): NamespaceStats[] {
  return [
    { name: 'production', podCount: 45, runningPods: 42, pendingPods: 2, failedPods: 1 },
    { name: 'kube-system', podCount: 28, runningPods: 28, pendingPods: 0, failedPods: 0 },
    { name: 'monitoring', podCount: 15, runningPods: 14, pendingPods: 1, failedPods: 0 },
    { name: 'staging', podCount: 12, runningPods: 10, pendingPods: 1, failedPods: 1 },
    { name: 'batch', podCount: 8, runningPods: 5, pendingPods: 3, failedPods: 0 },
    { name: 'default', podCount: 5, runningPods: 5, pendingPods: 0, failedPods: 0 },
  ]
}

// Operator types
export interface Operator {
  name: string
  namespace: string
  version: string
  status: 'Succeeded' | 'Failed' | 'Installing' | 'Upgrading'
  upgradeAvailable?: string
  cluster?: string
}

export interface OperatorSubscription {
  name: string
  namespace: string
  channel: string
  source: string
  installPlanApproval: 'Automatic' | 'Manual'
  currentCSV: string
  pendingUpgrade?: string
  cluster?: string
}

// Hook to get operators for a cluster
export function useOperators(cluster?: string) {
  const [operators, setOperators] = useState<Operator[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!cluster) {
      setOperators([])
      return
    }

    setIsLoading(true)
    try {
      // Try to fetch from API - will fall back to demo data if not available
      const { data } = await api.get<{ operators: Operator[] }>(`/api/mcp/operators?cluster=${encodeURIComponent(cluster)}`)
      setOperators(data.operators || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch operators')
      // Use demo data with cluster-specific variation
      setOperators(getDemoOperators(cluster))
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { operators, isLoading, error, refetch }
}

// Hook to get operator subscriptions for a cluster
export function useOperatorSubscriptions(cluster?: string) {
  const [subscriptions, setSubscriptions] = useState<OperatorSubscription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!cluster) {
      setSubscriptions([])
      return
    }

    setIsLoading(true)
    try {
      const { data } = await api.get<{ subscriptions: OperatorSubscription[] }>(`/api/mcp/operator-subscriptions?cluster=${encodeURIComponent(cluster)}`)
      setSubscriptions(data.subscriptions || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch subscriptions')
      setSubscriptions(getDemoOperatorSubscriptions(cluster))
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { subscriptions, isLoading, error, refetch }
}

function getDemoOperators(cluster: string): Operator[] {
  // Vary demo data slightly based on cluster name
  const suffix = cluster.includes('prod') ? '-prod' : cluster.includes('staging') ? '-staging' : ''
  return [
    { name: 'prometheus-operator', namespace: 'monitoring', version: 'v0.65.1', status: 'Succeeded', cluster },
    { name: 'cert-manager', namespace: 'cert-manager', version: 'v1.12.0', status: 'Succeeded', upgradeAvailable: 'v1.13.0', cluster },
    { name: `elasticsearch-operator${suffix}`, namespace: 'elastic-system', version: 'v2.8.0', status: 'Succeeded', cluster },
    { name: 'strimzi-kafka-operator', namespace: 'kafka', version: 'v0.35.0', status: cluster.includes('staging') ? 'Installing' : 'Succeeded', cluster },
    { name: 'argocd-operator', namespace: 'argocd', version: 'v0.6.0', status: cluster.includes('prod') ? 'Succeeded' : 'Failed', cluster },
  ]
}

function getDemoOperatorSubscriptions(cluster: string): OperatorSubscription[] {
  return [
    {
      name: 'prometheus-operator',
      namespace: 'monitoring',
      channel: 'stable',
      source: 'operatorhubio-catalog',
      installPlanApproval: 'Automatic',
      currentCSV: 'prometheusoperator.v0.65.1',
      cluster,
    },
    {
      name: 'cert-manager',
      namespace: 'cert-manager',
      channel: 'stable',
      source: 'operatorhubio-catalog',
      installPlanApproval: 'Manual',
      currentCSV: 'cert-manager.v1.12.0',
      pendingUpgrade: 'cert-manager.v1.13.0',
      cluster,
    },
    {
      name: 'strimzi-kafka-operator',
      namespace: 'kafka',
      channel: 'stable',
      source: 'operatorhubio-catalog',
      installPlanApproval: 'Automatic',
      currentCSV: 'strimzi-cluster-operator.v0.35.0',
      cluster,
    },
    {
      name: 'argocd-operator',
      namespace: 'argocd',
      channel: 'alpha',
      source: 'operatorhubio-catalog',
      installPlanApproval: 'Manual',
      currentCSV: 'argocd-operator.v0.6.0',
      pendingUpgrade: cluster.includes('staging') ? 'argocd-operator.v0.7.0' : undefined,
      cluster,
    },
  ]
}

function getDemoEvents(): ClusterEvent[] {
  return [
    {
      type: 'Warning',
      reason: 'FailedScheduling',
      message: 'No nodes available to schedule pod',
      object: 'Pod/worker-5c6d7e8f9-n3p2q',
      namespace: 'batch',
      cluster: 'vllm-d',
      count: 3,
    },
    {
      type: 'Normal',
      reason: 'Scheduled',
      message: 'Successfully assigned pod to node-2',
      object: 'Pod/api-server-7d8f9c6b5-abc12',
      namespace: 'production',
      cluster: 'prod-east',
      count: 1,
    },
    {
      type: 'Warning',
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      object: 'Pod/api-server-7d8f9c6b5-x2k4m',
      namespace: 'production',
      cluster: 'prod-east',
      count: 15,
    },
    {
      type: 'Normal',
      reason: 'Pulled',
      message: 'Container image pulled successfully',
      object: 'Pod/frontend-8e9f0a1b2-def34',
      namespace: 'web',
      cluster: 'staging',
      count: 1,
    },
    {
      type: 'Warning',
      reason: 'Unhealthy',
      message: 'Readiness probe failed: connection refused',
      object: 'Pod/cache-redis-0',
      namespace: 'data',
      cluster: 'staging',
      count: 8,
    },
  ]
}
