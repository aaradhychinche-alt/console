import { useState, useMemo } from 'react'
import { CheckCircle, Clock, XCircle, ChevronRight, Loader2 } from 'lucide-react'
import { ClusterBadge } from '../ui/ClusterBadge'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { CardControls, SortDirection } from '../ui/CardControls'
import { useDeployments } from '../../hooks/useMCP'

type SortByOption = 'status' | 'name' | 'cluster'

const SORT_OPTIONS = [
  { value: 'status' as const, label: 'Status' },
  { value: 'name' as const, label: 'Name' },
  { value: 'cluster' as const, label: 'Cluster' },
]

const statusConfig = {
  running: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    barColor: 'bg-green-500',
  },
  deploying: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    barColor: 'bg-yellow-500',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    barColor: 'bg-red-500',
  },
}

// Extract version from container image
function extractVersion(image?: string): string {
  if (!image) return 'unknown'
  // Extract tag from image like "nginx:1.19" or "gcr.io/project/app:v1.2.3"
  const parts = image.split(':')
  if (parts.length > 1) {
    const tag = parts[parts.length - 1]
    // Return shortened version for long hashes
    if (tag.length > 20) return tag.substring(0, 12)
    return tag
  }
  return 'latest'
}

export function DeploymentStatus() {
  const { drillToDeployment } = useDrillDownActions()
  const { deployments: allDeployments, isLoading } = useDeployments()
  const { selectedClusters, isAllClustersSelected, filterByStatus, customFilter } = useGlobalFilters()
  const [sortBy, setSortBy] = useState<SortByOption>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [limit, setLimit] = useState<number | 'unlimited'>(5)

  const statusOrder: Record<string, number> = { failed: 0, deploying: 1, running: 2 }

  // Filter by global filters
  const rawDeployments = useMemo(() => {
    let result = allDeployments

    // Filter by cluster selection
    if (!isAllClustersSelected) {
      result = result.filter(d => {
        const clusterName = d.cluster?.split('/').pop() || d.cluster || ''
        return selectedClusters.some(sc => sc.includes(clusterName) || clusterName.includes(sc.split('/').pop() || sc))
      })
    }

    // Apply status filter
    result = filterByStatus(result)

    // Apply custom text filter
    if (customFilter.trim()) {
      const query = customFilter.toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(query) ||
        (d.cluster?.toLowerCase() || '').includes(query) ||
        (d.namespace?.toLowerCase() || '').includes(query) ||
        (d.image?.toLowerCase() || '').includes(query)
      )
    }

    return result
  }, [allDeployments, selectedClusters, isAllClustersSelected, filterByStatus, customFilter])

  const deployments = useMemo(() => {
    const sorted = [...rawDeployments].sort((a, b) => {
      let result = 0
      if (sortBy === 'status') result = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3)
      else if (sortBy === 'name') result = a.name.localeCompare(b.name)
      else if (sortBy === 'cluster') result = (a.cluster || '').localeCompare(b.cluster || '')
      return sortDirection === 'asc' ? result : -result
    })
    if (limit === 'unlimited') return sorted
    return sorted.slice(0, limit)
  }, [rawDeployments, sortBy, sortDirection, limit])

  const activeDeployments = rawDeployments.filter((d) => d.status === 'deploying').length
  const failedDeployments = rawDeployments.filter((d) => d.status === 'failed').length

  const handleDeploymentClick = (deployment: typeof allDeployments[0]) => {
    const clusterName = deployment.cluster?.split('/').pop() || deployment.cluster || 'unknown'
    drillToDeployment(clusterName, deployment.namespace, deployment.name, {
      status: deployment.status,
      version: extractVersion(deployment.image),
      replicas: { ready: deployment.readyReplicas, desired: deployment.replicas },
      progress: deployment.progress,
    })
  }

  if (isLoading && rawDeployments.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Deployment Status
          </span>
          {activeDeployments > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400"
              title={`${activeDeployments} deployment${activeDeployments !== 1 ? 's' : ''} currently rolling out`}
            >
              {activeDeployments} deploying
            </span>
          )}
          {failedDeployments > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400"
              title={`${failedDeployments} deployment${failedDeployments !== 1 ? 's' : ''} in failed state`}
            >
              {failedDeployments} failed
            </span>
          )}
        </div>
        <CardControls
          limit={limit}
          onLimitChange={setLimit}
          sortBy={sortBy}
          sortOptions={SORT_OPTIONS}
          onSortChange={setSortBy}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
        />
      </div>

      {/* Deployments list */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {deployments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No deployments found
          </div>
        ) : deployments.map((deployment) => {
          const config = statusConfig[deployment.status as keyof typeof statusConfig] || statusConfig.running
          const StatusIcon = config.icon
          const clusterName = deployment.cluster?.split('/').pop() || deployment.cluster || 'unknown'
          const version = extractVersion(deployment.image)

          return (
            <div
              key={`${deployment.cluster}-${deployment.namespace}-${deployment.name}`}
              onClick={() => handleDeploymentClick(deployment)}
              className="p-3 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:bg-secondary/50 hover:border-border transition-colors group"
              title={`Click to view details for ${deployment.name}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ClusterBadge cluster={clusterName} />
                    <span title={`Status: ${deployment.status}`}><StatusIcon className={`w-4 h-4 ${config.color}`} /></span>
                  </div>
                  <span className="text-sm font-medium text-foreground" title={deployment.name}>
                    {deployment.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2" title={`Namespace: ${deployment.namespace}`}>
                    {deployment.namespace}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-foreground" title={`Version: ${version}`}>{version}</span>
                    </div>
                    <span className="text-xs text-muted-foreground" title={`${deployment.readyReplicas} of ${deployment.replicas} replicas ready`}>
                      {deployment.readyReplicas}/{deployment.replicas} ready
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden" title={`Deployment progress: ${deployment.progress}%`}>
                <div
                  className={`h-full ${config.barColor} transition-all duration-500`}
                  style={{ width: `${deployment.progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
