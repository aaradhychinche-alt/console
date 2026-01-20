import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Info, XCircle, RefreshCw, ChevronRight } from 'lucide-react'
import { useEvents } from '../../hooks/useMCP'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { ClusterBadge } from '../ui/ClusterBadge'
import { CardControls, SortDirection } from '../ui/CardControls'
import { Pagination, usePagination } from '../ui/Pagination'
import { LimitedAccessWarning } from '../ui/LimitedAccessWarning'

type SortByOption = 'time' | 'count' | 'type'

// Format relative time (e.g., "2m ago", "1h ago")
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const SORT_OPTIONS = [
  { value: 'time' as const, label: 'Time' },
  { value: 'count' as const, label: 'Count' },
  { value: 'type' as const, label: 'Type' },
]

export function EventStream() {
  const [itemsPerPage, setItemsPerPage] = useState<number | 'unlimited'>(5)
  const [sortBy, setSortBy] = useState<SortByOption>('time')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [loadingTooLong, setLoadingTooLong] = useState(false)
  // Fetch more events from API to enable pagination
  const { events: rawEvents, isLoading, isRefreshing, lastUpdated, error, refetch } = useEvents(undefined, undefined, 100)
  const { filterByCluster } = useGlobalFilters()

  // Track if loading is taking too long
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setLoadingTooLong(true), 10000)
      return () => clearTimeout(timer)
    } else {
      setLoadingTooLong(false)
    }
  }, [isLoading])

  // Filter and sort events
  const filteredAndSorted = useMemo(() => {
    const filtered = filterByCluster(rawEvents)
    const sorted = [...filtered].sort((a, b) => {
      let result = 0
      if (sortBy === 'count') result = b.count - a.count
      else if (sortBy === 'type') result = a.type.localeCompare(b.type)
      // 'time' - keep original order (already sorted by time desc)
      return sortDirection === 'asc' ? -result : result
    })
    return sorted
  }, [rawEvents, sortBy, sortDirection, filterByCluster])

  // Use pagination hook
  const effectivePerPage = itemsPerPage === 'unlimited' ? 1000 : itemsPerPage
  const {
    paginatedItems: events,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: perPage,
    goToPage,
    needsPagination,
  } = usePagination(filteredAndSorted, effectivePerPage)
  const { drillToEvents, drillToPod, drillToDeployment } = useDrillDownActions()

  const handleEventClick = (event: typeof events[0]) => {
    // Parse object to get resource type and name
    const [resourceType, resourceName] = event.object.split('/')
    const cluster = event.cluster || 'default'

    if (resourceType.toLowerCase() === 'pod') {
      drillToPod(cluster, event.namespace, resourceName, { fromEvent: true })
    } else if (resourceType.toLowerCase() === 'deployment' || resourceType.toLowerCase() === 'replicaset') {
      drillToDeployment(cluster, event.namespace, resourceName, { fromEvent: true })
    } else {
      // Generic events view for other resources
      drillToEvents(cluster, event.namespace, event.object)
    }
  }

  const getEventStyle = (type: string) => {
    if (type === 'Warning') {
      return { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', tooltip: 'Warning event - Potential issue detected' }
    }
    if (type === 'Error') {
      return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', tooltip: 'Error event - Action required' }
    }
    return { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', tooltip: 'Informational event' }
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="spinner w-8 h-8" />
        {loadingTooLong && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Loading taking longer than expected...</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Recent Events</span>
        <div className="flex items-center gap-2">
          <CardControls
            limit={itemsPerPage}
            onLimitChange={setItemsPerPage}
            sortBy={sortBy}
            sortOptions={SORT_OPTIONS}
            onSortChange={setSortBy}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
          />
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground" title={`Last updated: ${lastUpdated.toLocaleString()}`}>
              {formatTimeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefreshing}
            className="p-1 hover:bg-secondary rounded transition-colors disabled:opacity-50"
            title={isRefreshing ? 'Refreshing...' : 'Refresh events'}
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No recent events
          </div>
        ) : (
          events.map((event, idx) => {
            const style = getEventStyle(event.type)
            const EventIcon = style.icon

            return (
              <div
                key={`${event.object}-${idx}`}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group"
                onClick={() => handleEventClick(event)}
                title={`Click to view details for ${event.object}`}
              >
                <div className={`p-1.5 rounded ${style.bg} flex-shrink-0`} title={style.tooltip}>
                  <EventIcon className={`w-3.5 h-3.5 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ClusterBadge cluster={event.cluster || 'default'} />
                    <span className="text-xs text-muted-foreground truncate" title={`Namespace: ${event.namespace}`}>{event.namespace}</span>
                  </div>
                  <p className="text-sm text-foreground truncate" title={event.message}>{event.message}</p>
                  <p className="text-xs text-muted-foreground truncate" title={`Resource: ${event.object}`}>
                    {event.object}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {event.count > 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground" title={`Event occurred ${event.count} times`}>
                      x{event.count}
                    </span>
                  )}
                  <span title="Click to view details"><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                </div>
              </div>
            )
          })
        )}
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
