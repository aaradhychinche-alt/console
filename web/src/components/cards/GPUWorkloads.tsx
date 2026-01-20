import { useState, useMemo } from 'react'
import { RefreshCw, Cpu, Box, ChevronRight, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useGPUNodes, usePods, useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { ClusterBadge } from '../ui/ClusterBadge'
import { CardControls, SortDirection } from '../ui/CardControls'

interface GPUWorkloadsProps {
  config?: Record<string, unknown>
}

type SortByOption = 'status' | 'name' | 'namespace' | 'cluster'

const SORT_OPTIONS = [
  { value: 'status' as const, label: 'Status' },
  { value: 'name' as const, label: 'Name' },
  { value: 'namespace' as const, label: 'Namespace' },
  { value: 'cluster' as const, label: 'Cluster' },
]

// NVIDIA-related namespace patterns
const NVIDIA_NAMESPACE_PATTERNS = [
  /^nvidia/i,
  /^gpu-operator/i,
  /^gpu/i,
  /dcgm/i,
  /^vllm/i,
  /^ml-/i,
  /^ai-/i,
  /^inference/i,
]

function isNvidiaNamespace(namespace: string): boolean {
  return NVIDIA_NAMESPACE_PATTERNS.some(pattern => pattern.test(namespace))
}

export function GPUWorkloads({ config: _config }: GPUWorkloadsProps) {
  const { nodes: gpuNodes, isLoading: gpuLoading, refetch: refetchGPU } = useGPUNodes()
  const { pods: allPods, isLoading: podsLoading, refetch: refetchPods } = usePods()
  const { clusters } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { drillToPod } = useDrillDownActions()

  const [sortBy, setSortBy] = useState<SortByOption>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [limit, setLimit] = useState<number | 'unlimited'>(5)

  const isLoading = gpuLoading || podsLoading

  // Get names of reachable clusters for filtering
  const reachableClusterNames = useMemo(() => {
    return new Set(clusters.filter(c => c.reachable !== false).map(c => c.name))
  }, [clusters])

  // Get clusters with GPUs (only from reachable clusters)
  const gpuClusters = useMemo(() => {
    const gpuClusterSet = new Set<string>()
    gpuNodes.forEach(node => {
      // Only include if the cluster is reachable
      if (reachableClusterNames.has(node.cluster)) {
        gpuClusterSet.add(node.cluster)
      }
    })
    return gpuClusterSet
  }, [gpuNodes, reachableClusterNames])

  // Get GPU node names for filtering (only from reachable clusters)
  const gpuNodeNames = useMemo(() => {
    return new Set(
      gpuNodes
        .filter(n => reachableClusterNames.has(n.cluster))
        .map(n => n.name)
    )
  }, [gpuNodes, reachableClusterNames])

  // Filter pods that are either:
  // 1. Running on GPU nodes
  // 2. In NVIDIA-related namespaces
  // 3. In clusters that have GPUs
  // AND exclude pods from unreachable clusters
  const gpuWorkloads = useMemo(() => {
    let filtered = allPods.filter(pod => {
      // Must be from a reachable cluster
      if (!pod.cluster || !reachableClusterNames.has(pod.cluster)) return false

      // Must be in a GPU cluster
      if (!gpuClusters.has(pod.cluster)) return false

      // Either on a GPU node or in NVIDIA namespace
      const isOnGPUNode = pod.node && gpuNodeNames.has(pod.node)
      const isInNvidiaNamespace = isNvidiaNamespace(pod.namespace || '')

      return isOnGPUNode || isInNvidiaNamespace
    })

    // Apply global cluster filter
    if (!isAllClustersSelected) {
      filtered = filtered.filter(pod =>
        selectedClusters.some(c => (pod.cluster || '').includes(c) || c.includes(pod.cluster || ''))
      )
    }

    return filtered
  }, [allPods, gpuClusters, gpuNodeNames, selectedClusters, isAllClustersSelected, reachableClusterNames])

  // Sort and limit workloads
  const sortedWorkloads = useMemo(() => {
    const statusOrder: Record<string, number> = {
      CrashLoopBackOff: 0,
      Error: 1,
      ImagePullBackOff: 2,
      Pending: 3,
      Running: 4,
      Succeeded: 5,
      Completed: 6,
    }

    const sorted = [...gpuWorkloads].sort((a, b) => {
      let result = 0
      if (sortBy === 'status') {
        result = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
      } else if (sortBy === 'name') {
        result = a.name.localeCompare(b.name)
      } else if (sortBy === 'namespace') {
        result = (a.namespace || '').localeCompare(b.namespace || '')
      } else if (sortBy === 'cluster') {
        result = (a.cluster || '').localeCompare(b.cluster || '')
      }
      return sortDirection === 'asc' ? result : -result
    })

    if (limit === 'unlimited') return sorted
    return sorted.slice(0, limit)
  }, [gpuWorkloads, sortBy, sortDirection, limit])

  const handleRefresh = () => {
    refetchGPU()
    refetchPods()
  }

  const handlePodClick = (pod: typeof allPods[0]) => {
    drillToPod(pod.cluster || '', pod.namespace || '', pod.name)
  }

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'Running':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' }
      case 'Succeeded':
      case 'Completed':
        return { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20' }
      case 'Pending':
        return { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
      default:
        return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' }
    }
  }

  // Count summary
  const summary = useMemo(() => {
    const running = gpuWorkloads.filter(p => p.status === 'Running').length
    const pending = gpuWorkloads.filter(p => p.status === 'Pending').length
    const failed = gpuWorkloads.filter(p => ['CrashLoopBackOff', 'Error', 'ImagePullBackOff'].includes(p.status)).length
    return { running, pending, failed, total: gpuWorkloads.length }
  }, [gpuWorkloads])

  if (isLoading && gpuWorkloads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }

  if (gpuNodes.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-muted-foreground">GPU Workloads</span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Cpu className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">No GPU Nodes</p>
          <p className="text-sm text-muted-foreground">No GPU resources detected in any cluster</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-muted-foreground">GPU Workloads</span>
          {summary.total > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
              {summary.total} pods
            </span>
          )}
          {summary.failed > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              {summary.failed} failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CardControls
            limit={limit}
            onLimitChange={setLimit}
            sortBy={sortBy}
            sortOptions={SORT_OPTIONS}
            onSortChange={setSortBy}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
          />
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-secondary rounded transition-colors"
            title="Refresh GPU workloads"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-secondary/30 text-center" title={`${summary.total} total GPU workloads`}>
          <p className="text-lg font-bold text-foreground">{summary.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30 text-center" title={`${summary.running} running`}>
          <p className="text-lg font-bold text-green-400">{summary.running}</p>
          <p className="text-xs text-muted-foreground">Running</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30 text-center" title={`${summary.pending} pending`}>
          <p className="text-lg font-bold text-yellow-400">{summary.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30 text-center" title={`${summary.failed} failed`}>
          <p className="text-lg font-bold text-red-400">{summary.failed}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>

      {/* Workload list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {sortedWorkloads.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No GPU workloads found
          </div>
        ) : (
          sortedWorkloads.map((pod) => {
            const statusDisplay = getStatusDisplay(pod.status)
            const clusterName = pod.cluster?.split('/').pop() || pod.cluster || 'unknown'

            return (
              <div
                key={`${pod.cluster}-${pod.namespace}-${pod.name}`}
                onClick={() => handlePodClick(pod)}
                className="p-3 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:bg-secondary/50 hover:border-border transition-colors group"
                title={`Click to view details for ${pod.name}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ClusterBadge cluster={clusterName} size="sm" />
                      <span className={`px-1.5 py-0.5 rounded text-xs ${statusDisplay.bg} ${statusDisplay.color}`}>
                        {pod.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{pod.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span title={`Namespace: ${pod.namespace}`}>{pod.namespace}</span>
                      {pod.node && (
                        <>
                          <span className="text-border">|</span>
                          <span title={`Node: ${pod.node}`}>{pod.node}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
