import { useState, useMemo, useRef, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Clock, Scale, ChevronRight, Search, Filter, ChevronDown, Server } from 'lucide-react'
import { useDeploymentIssues, DeploymentIssue, useClusters } from '../../hooks/useMCP'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { ClusterBadge } from '../ui/ClusterBadge'
import { CardControls, SortDirection } from '../ui/CardControls'
import { Pagination, usePagination } from '../ui/Pagination'
import { Skeleton } from '../ui/Skeleton'
import { LimitedAccessWarning } from '../ui/LimitedAccessWarning'
import { RefreshButton } from '../ui/RefreshIndicator'

type SortByOption = 'status' | 'name' | 'cluster'

const SORT_OPTIONS = [
  { value: 'status' as const, label: 'Status' },
  { value: 'name' as const, label: 'Name' },
  { value: 'cluster' as const, label: 'Cluster' },
]

interface DeploymentIssuesProps {
  config?: Record<string, unknown>
}

const getIssueIcon = (status: string): { icon: typeof AlertCircle; tooltip: string } => {
  if (status.includes('Unavailable')) return { icon: AlertCircle, tooltip: 'Deployment unavailable - Not enough replicas are ready' }
  if (status.includes('Progressing')) return { icon: Clock, tooltip: 'Deployment in progress - Rollout is ongoing' }
  if (status.includes('ReplicaFailure')) return { icon: Scale, tooltip: 'Replica failure - Failed to create or maintain replicas' }
  return { icon: AlertTriangle, tooltip: 'Deployment issue - Check deployment status' }
}

export function DeploymentIssues({ config }: DeploymentIssuesProps) {
  const cluster = config?.cluster as string | undefined
  const namespace = config?.namespace as string | undefined
  const {
    issues: rawIssues,
    isLoading: hookLoading,
    isRefreshing,
    error,
    refetch,
    isFailed,
    consecutiveFailures,
    lastRefresh
  } = useDeploymentIssues(cluster, namespace)

  // Only show skeleton when no cached data exists
  const isLoading = hookLoading && rawIssues.length === 0
  const { drillToDeployment } = useDrillDownActions()
  const { filterByCluster, selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { clusters } = useClusters()
  const [sortBy, setSortBy] = useState<SortByOption>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [itemsPerPage, setItemsPerPage] = useState<number | 'unlimited'>(5)
  const [localSearch, setLocalSearch] = useState('')
  const [localClusterFilter, setLocalClusterFilter] = useState<string[]>([])
  const [showClusterFilter, setShowClusterFilter] = useState(false)
  const clusterFilterRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clusterFilterRef.current && !clusterFilterRef.current.contains(event.target as Node)) {
        setShowClusterFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get available clusters for local filter (respects global filter)
  const availableClustersForFilter = useMemo(() => {
    const reachable = clusters.filter(c => c.reachable !== false)
    if (isAllClustersSelected) return reachable
    return reachable.filter(c => selectedClusters.includes(c.name))
  }, [clusters, selectedClusters, isAllClustersSelected])

  const toggleClusterFilter = (clusterName: string) => {
    setLocalClusterFilter(prev => {
      if (prev.includes(clusterName)) {
        return prev.filter(c => c !== clusterName)
      }
      return [...prev, clusterName]
    })
  }

  // Filter and sort issues
  const filteredAndSorted = useMemo(() => {
    let filtered = filterByCluster(rawIssues)

    // Apply local cluster filter (on top of global)
    if (localClusterFilter.length > 0) {
      filtered = filtered.filter(issue => issue.cluster && localClusterFilter.includes(issue.cluster))
    }

    // Apply local search
    if (localSearch.trim()) {
      const query = localSearch.toLowerCase()
      filtered = filtered.filter(issue =>
        issue.name.toLowerCase().includes(query) ||
        issue.namespace.toLowerCase().includes(query) ||
        (issue.cluster?.toLowerCase() || '').includes(query) ||
        (issue.reason?.toLowerCase() || '').includes(query) ||
        (issue.message?.toLowerCase() || '').includes(query)
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      let result = 0
      if (sortBy === 'status') result = (a.reason || '').localeCompare(b.reason || '')
      else if (sortBy === 'name') result = a.name.localeCompare(b.name)
      else if (sortBy === 'cluster') result = (a.cluster || '').localeCompare(b.cluster || '')
      return sortDirection === 'asc' ? result : -result
    })
    return sorted
  }, [rawIssues, sortBy, sortDirection, filterByCluster, localSearch, localClusterFilter])

  // Use pagination hook
  const effectivePerPage = itemsPerPage === 'unlimited' ? 1000 : itemsPerPage
  const {
    paginatedItems: issues,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: perPage,
    goToPage,
    needsPagination,
  } = usePagination(filteredAndSorted, effectivePerPage)

  const handleDeploymentClick = (issue: DeploymentIssue) => {
    drillToDeployment(issue.cluster || 'default', issue.namespace, issue.name, {
      replicas: issue.replicas,
      readyReplicas: issue.readyReplicas,
      reason: issue.reason,
      message: issue.message,
    })
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col min-h-card">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton variant="text" width={120} height={16} />
            <Skeleton variant="rounded" width={24} height={18} />
          </div>
          <Skeleton variant="rounded" width={120} height={28} />
        </div>
        {/* Issue items skeleton */}
        <div className="flex-1 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={100} />
          ))}
        </div>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="h-full flex flex-col min-h-card content-loaded">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Deployment Issues</span>
          <RefreshButton
            isRefreshing={isRefreshing}
            isFailed={isFailed}
            consecutiveFailures={consecutiveFailures}
            lastRefresh={lastRefresh}
            onRefresh={() => refetch()}
          />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3" title="All deployments are healthy">
            <svg
              className="w-6 h-6 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-foreground font-medium">All deployments healthy</p>
          <p className="text-sm text-muted-foreground">No issues detected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-card content-loaded">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Deployment Issues</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400" title={`${rawIssues.length} deployments with issues`}>
            {rawIssues.length}
          </span>
          {localClusterFilter.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
              <Server className="w-3 h-3" />
              {localClusterFilter.length}/{availableClustersForFilter.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Cluster Filter */}
          {availableClustersForFilter.length > 1 && (
            <div ref={clusterFilterRef} className="relative">
              <button
                onClick={() => setShowClusterFilter(!showClusterFilter)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-colors ${
                  localClusterFilter.length > 0
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
                title="Filter by cluster"
              >
                <Filter className="w-3 h-3" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {showClusterFilter && (
                <div className="absolute top-full right-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-lg bg-card border border-border shadow-lg z-50">
                  <div className="p-1">
                    <button
                      onClick={() => setLocalClusterFilter([])}
                      className={`w-full px-2 py-1.5 text-xs text-left rounded transition-colors ${
                        localClusterFilter.length === 0 ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      All clusters
                    </button>
                    {availableClustersForFilter.map(cluster => (
                      <button
                        key={cluster.name}
                        onClick={() => toggleClusterFilter(cluster.name)}
                        className={`w-full px-2 py-1.5 text-xs text-left rounded transition-colors ${
                          localClusterFilter.includes(cluster.name) ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-secondary text-foreground'
                        }`}
                      >
                        {cluster.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <CardControls
            limit={itemsPerPage}
            onLimitChange={setItemsPerPage}
            sortBy={sortBy}
            sortOptions={SORT_OPTIONS}
            onSortChange={setSortBy}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
          />
          <RefreshButton
            isRefreshing={isRefreshing}
            isFailed={isFailed}
            consecutiveFailures={consecutiveFailures}
            lastRefresh={lastRefresh}
            onRefresh={() => refetch()}
          />
        </div>
      </div>

      {/* Local Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search issues..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50"
        />
      </div>

      {/* Issues list */}
      <div className="flex-1 space-y-3 overflow-y-auto min-h-card-content">
        {issues.map((issue, idx) => {
          const { icon: Icon, tooltip: iconTooltip } = getIssueIcon(issue.reason || '')

          return (
            <div
              key={`${issue.name}-${idx}`}
              className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 cursor-pointer hover:bg-orange-500/15 transition-colors"
              onClick={() => handleDeploymentClick(issue)}
              title={`Click to view details for ${issue.name}`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0" title={iconTooltip}>
                  <Icon className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ClusterBadge cluster={issue.cluster || 'default'} />
                    <span className="text-xs text-muted-foreground" title={`Namespace: ${issue.namespace}`}>{issue.namespace}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate" title={issue.name}>{issue.name}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400" title={`Issue: ${issue.reason || 'Unknown'}`}>
                      {issue.reason || 'Issue'}
                    </span>
                    <span className="text-xs text-muted-foreground" title={`${issue.readyReplicas} of ${issue.replicas} replicas are ready`}>
                      {issue.readyReplicas}/{issue.replicas} ready
                    </span>
                  </div>
                  {issue.message && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={issue.message}>
                      {issue.message}
                    </p>
                  )}
                </div>
                <span title="Click to view details"><ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /></span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {needsPagination && itemsPerPage !== 'unlimited' && (
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

      <LimitedAccessWarning hasError={!!error} className="mt-2" />
    </div>
  )
}
