import { useMemo } from 'react'
import { RefreshCw, Zap } from 'lucide-react'
import { useGPUNodes, useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useDrillDownActions } from '../../hooks/useDrillDown'

interface GPUOverviewProps {
  config?: Record<string, unknown>
}

export function GPUOverview({ config: _config }: GPUOverviewProps) {
  const { nodes: rawNodes, isLoading, refetch } = useGPUNodes()
  const { clusters } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { drillToResources } = useDrillDownActions()

  // Filter nodes by global cluster selection
  const nodes = useMemo(() => {
    if (isAllClustersSelected) return rawNodes
    return rawNodes.filter(n => selectedClusters.some(c => n.cluster.startsWith(c)))
  }, [rawNodes, selectedClusters, isAllClustersSelected])

  // Check if any selected clusters are reachable
  const filteredClusters = useMemo(() => {
    if (isAllClustersSelected) return clusters
    return clusters.filter(c => selectedClusters.includes(c.name))
  }, [clusters, selectedClusters, isAllClustersSelected])

  const hasReachableClusters = filteredClusters.some(c => c.reachable !== false && c.nodeCount !== undefined && c.nodeCount > 0)

  if (isLoading && hasReachableClusters) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }

  // No reachable clusters
  if (!hasReachableClusters) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-muted-foreground">GPU Overview</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No reachable clusters
        </div>
      </div>
    )
  }

  const totalGPUs = nodes.reduce((sum, n) => sum + n.gpuCount, 0)
  const allocatedGPUs = nodes.reduce((sum, n) => sum + n.gpuAllocated, 0)
  const gpuUtilization = totalGPUs > 0 ? (allocatedGPUs / totalGPUs) * 100 : 0

  // Group by type
  const gpuTypes = nodes.reduce((acc, n) => {
    if (!acc[n.gpuType]) acc[n.gpuType] = 0
    acc[n.gpuType] += n.gpuCount
    return acc
  }, {} as Record<string, number>)

  const clusterCount = new Set(nodes.map(n => n.cluster)).size

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-muted-foreground">GPU Overview</span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 hover:bg-secondary rounded transition-colors"
          title="Refresh GPU data"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Main gauge */}
      <div className="flex justify-center mb-4" title={`GPU Utilization: ${allocatedGPUs} of ${totalGPUs} GPUs allocated (${gpuUtilization.toFixed(0)}%)`}>
        <div className="relative w-32 h-32 cursor-default">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-secondary"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${gpuUtilization * 3.52} 352`}
              className={`${
                gpuUtilization > 80 ? 'text-red-500' :
                gpuUtilization > 50 ? 'text-yellow-500' :
                'text-green-500'
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{gpuUtilization.toFixed(0)}%</span>
            <span className="text-xs text-muted-foreground">Utilized</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div
          className={`text-center ${totalGPUs > 0 ? 'cursor-pointer hover:bg-secondary/50 rounded-lg' : 'cursor-default'} transition-colors p-1`}
          onClick={() => totalGPUs > 0 && drillToResources()}
          title={totalGPUs > 0 ? `${totalGPUs} total GPUs - Click for details` : 'No GPUs available'}
        >
          <p className="text-lg font-bold text-foreground">{totalGPUs}</p>
          <p className="text-xs text-muted-foreground">Total GPUs</p>
        </div>
        <div
          className={`text-center ${allocatedGPUs > 0 ? 'cursor-pointer hover:bg-secondary/50 rounded-lg' : 'cursor-default'} transition-colors p-1`}
          onClick={() => allocatedGPUs > 0 && drillToResources()}
          title={allocatedGPUs > 0 ? `${allocatedGPUs} GPUs allocated - Click for details` : 'No GPUs allocated'}
        >
          <p className="text-lg font-bold text-purple-400">{allocatedGPUs}</p>
          <p className="text-xs text-muted-foreground">Allocated</p>
        </div>
        <div
          className={`text-center ${clusterCount > 0 ? 'cursor-pointer hover:bg-secondary/50 rounded-lg' : 'cursor-default'} transition-colors p-1`}
          onClick={() => clusterCount > 0 && drillToResources()}
          title={clusterCount > 0 ? `${clusterCount} cluster${clusterCount !== 1 ? 's' : ''} with GPUs - Click for details` : 'No clusters with GPUs'}
        >
          <p className="text-lg font-bold text-green-400">{clusterCount}</p>
          <p className="text-xs text-muted-foreground">Clusters</p>
        </div>
      </div>

      {/* GPU Types */}
      {Object.keys(gpuTypes).length > 0 && (
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-2">GPU Types</p>
          <div className="space-y-1">
            {Object.entries(gpuTypes).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-secondary/50 rounded px-1 transition-colors"
                onClick={() => drillToResources()}
                title={`${count} ${type} GPU${count !== 1 ? 's' : ''} - Click to view nodes with this GPU type`}
              >
                <span className="text-foreground">{type}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
