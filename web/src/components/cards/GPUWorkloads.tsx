import { useState, useMemo } from 'react'
import { RefreshCw, Cpu, Box, ChevronRight, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useGPUNodes, useAllPods, useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { ClusterBadge } from '../ui/ClusterBadge'
import { CardControls, SortDirection } from '../ui/CardControls'
import { Pagination, usePagination } from '../ui/Pagination'

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

// Check if pod labels/annotations indicate GPU affinity or GPU-related workload
function hasGPUAffinity(labels?: Record<string, string>, annotations?: Record<string, string>): boolean {
  const gpuLabels = [
    'nvidia.com/gpu',
    'nvidia.com/gpu.product',
    'nvidia.com/gpu.count',
    'amd.com/gpu',
    'gpu.intel.com/i915',
    'accelerator',
  ]

  const gpuAnnotationPatterns = [
    /nvidia/i,
    /gpu/i,
    /cuda/i,
  ]

  // Check labels
  if (labels) {
    for (const key of Object.keys(labels)) {
      if (gpuLabels.some(gl => key.includes(gl)) || /gpu/i.test(key)) {
        return true
      }
    }
  }

  // Check annotations for GPU-related content
  if (annotations) {
    for (const [key, value] of Object.entries(annotations)) {
      if (gpuAnnotationPatterns.some(p => p.test(key) || p.test(value))) {
        return true
      }
    }
  }

  return false
}

// Normalize cluster name for matching (handle kubeconfig/xxx format)
function normalizeClusterName(cluster: string): string {
  if (!cluster) return ''
  // If it's a path like "kubeconfig/cluster-name", extract just the cluster name
  const parts = cluster.split('/')
  return parts[parts.length - 1] || cluster
}

// GPU/ML-related namespace patterns - fallback for identifying GPU workloads
const GPU_NAMESPACE_PATTERNS = [
  /^nvidia/i,
  /^gpu-operator/i,
  /^gpu/i,
  /gpu/i,           // Any namespace containing "gpu"
  /dcgm/i,
  /^vllm/i,
  /vllm/i,          // Any namespace containing "vllm"
  /^ml-/i,
  /^ai-/i,
  /^inference/i,
  /^llm/i,
  /^ollama/i,
  /^kubeai/i,
  /^ray/i,          // Ray clusters
  /^kubeflow/i,     // Kubeflow
  /^mlflow/i,       // MLflow
  /^triton/i,       // NVIDIA Triton
  /^tensorrt/i,     // TensorRT
  /^pytorch/i,      // PyTorch
  /^tensorflow/i,   // TensorFlow
  /^huggingface/i,  // HuggingFace
  /^transformers/i, // Transformers
  /^model/i,        // Model serving namespaces
  /^training/i,     // Training namespaces
  /^serving/i,      // Serving namespaces
]

function isGPURelatedNamespace(namespace: string): boolean {
  return GPU_NAMESPACE_PATTERNS.some(pattern => pattern.test(namespace))
}

export function GPUWorkloads({ config: _config }: GPUWorkloadsProps) {
  const { nodes: gpuNodes, isLoading: gpuLoading, refetch: refetchGPU } = useGPUNodes()
  const { pods: allPods, isLoading: podsLoading, refetch: refetchPods } = useAllPods()
  useClusters() // Keep hook for cache warming
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { drillToPod } = useDrillDownActions()

  const [sortBy, setSortBy] = useState<SortByOption>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [limit, setLimit] = useState<number | 'unlimited'>(5)

  const isLoading = gpuLoading || podsLoading

  // Filter pods that are running on GPU nodes
  // This is the most accurate way to identify GPU workloads
  const gpuWorkloads = useMemo(() => {
    // Build a map of GPU node names by normalized cluster name for robust lookup
    const gpuNodesByCluster = new Map<string, Set<string>>()
    // Also build a global set of all GPU node names for fallback matching
    const allGPUNodeNames = new Set<string>()

    gpuNodes.forEach(node => {
      const normalizedCluster = normalizeClusterName(node.cluster)
      if (!gpuNodesByCluster.has(normalizedCluster)) {
        gpuNodesByCluster.set(normalizedCluster, new Set())
      }
      gpuNodesByCluster.get(normalizedCluster)!.add(node.name)
      allGPUNodeNames.add(node.name)
    })

    // Helper to check if pod is on a GPU node
    const checkIsOnGPUNode = (pod: typeof allPods[0]) => {
      if (!pod.node) return false

      // First try cluster-specific lookup
      if (pod.cluster) {
        const normalizedPodCluster = normalizeClusterName(pod.cluster)
        const nodeSet = gpuNodesByCluster.get(normalizedPodCluster)
        if (nodeSet?.has(pod.node)) return true
      }

      // Fallback: check if pod's node matches any GPU node name across all clusters
      // This handles edge cases where cluster names might not match exactly
      return allGPUNodeNames.has(pod.node)
    }

    let filtered = allPods.filter(pod => {
      // Must have a cluster
      if (!pod.cluster) return false

      // Primary check: is this pod running on a GPU node?
      // This is the most reliable indicator of GPU workload
      if (checkIsOnGPUNode(pod)) return true

      // Secondary check: does the pod have GPU-related affinity/labels?
      // This catches pods configured for GPU even if not yet scheduled
      if (hasGPUAffinity(pod.labels, pod.annotations)) return true

      // Tertiary check: is the pod in a GPU-related namespace?
      // This is a fallback heuristic for when node info isn't available
      if (isGPURelatedNamespace(pod.namespace || '')) return true

      return false
    })

    // Apply global cluster filter
    if (!isAllClustersSelected) {
      filtered = filtered.filter(pod => {
        const normalizedPodCluster = normalizeClusterName(pod.cluster || '')
        return selectedClusters.some(c => {
          const normalizedSelectedCluster = normalizeClusterName(c)
          return normalizedPodCluster === normalizedSelectedCluster ||
                 normalizedPodCluster.includes(normalizedSelectedCluster) ||
                 normalizedSelectedCluster.includes(normalizedPodCluster)
        })
      })
    }

    return filtered
  }, [allPods, gpuNodes, selectedClusters, isAllClustersSelected])

  // Sort workloads
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
    return sorted
  }, [gpuWorkloads, sortBy, sortDirection])

  // Use pagination hook
  const effectivePerPage = limit === 'unlimited' ? 1000 : limit
  const {
    paginatedItems: displayWorkloads,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: perPage,
    goToPage,
    needsPagination,
  } = usePagination(sortedWorkloads, effectivePerPage)

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
        {displayWorkloads.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No GPU workloads found
          </div>
        ) : (
          displayWorkloads.map((pod) => {
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

      {/* Pagination */}
      {needsPagination && limit !== 'unlimited' && (
        <div className="pt-2 border-t border-border/50 mt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={perPage}
            onPageChange={goToPage}
            showItemsPerPage={false}
          />
        </div>
      )}
    </div>
  )
}
