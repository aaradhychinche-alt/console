import { useMemo } from 'react'
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useEvents } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { RefreshIndicator } from '../ui/RefreshIndicator'

interface TimePoint {
  time: string
  timestamp: number
  warnings: number
  normal: number
  total: number
}

// Group events by time buckets
function groupEventsByTime(events: Array<{ type: string; lastSeen?: string; firstSeen?: string; count: number }>, bucketMinutes = 5): TimePoint[] {
  const now = Date.now()
  const bucketMs = bucketMinutes * 60 * 1000
  const numBuckets = 12 // Last hour in 5-minute buckets

  // Initialize buckets
  const buckets: TimePoint[] = []
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketTime = now - (i * bucketMs)
    const date = new Date(bucketTime)
    buckets.push({
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: bucketTime,
      warnings: 0,
      normal: 0,
      total: 0,
    })
  }

  // Place events in buckets
  events.forEach(event => {
    const eventTime = event.lastSeen ? new Date(event.lastSeen).getTime() :
                      event.firstSeen ? new Date(event.firstSeen).getTime() : now

    // Find the bucket this event belongs to
    for (let i = 0; i < buckets.length; i++) {
      const bucketStart = buckets[i].timestamp - bucketMs
      const bucketEnd = buckets[i].timestamp

      if (eventTime >= bucketStart && eventTime < bucketEnd) {
        if (event.type === 'Warning') {
          buckets[i].warnings += event.count || 1
        } else {
          buckets[i].normal += event.count || 1
        }
        buckets[i].total += event.count || 1
        break
      }
    }
  })

  return buckets
}

export function EventsTimeline() {
  const { events, isLoading, isRefreshing, lastUpdated } = useEvents(undefined, undefined, 100)
  const { selectedClusters, isAllClustersSelected, clusterInfoMap } = useGlobalFilters()

  // Filter events by selected clusters AND exclude offline/unreachable clusters
  const filteredEvents = useMemo(() => {
    // First filter to only events from reachable clusters
    const reachableEvents = events.filter(e => {
      if (!e.cluster) return true // Include events without cluster info
      const clusterInfo = clusterInfoMap[e.cluster]
      return !clusterInfo || clusterInfo.reachable !== false
    })
    if (isAllClustersSelected) return reachableEvents
    return reachableEvents.filter(e => e.cluster && selectedClusters.includes(e.cluster))
  }, [events, selectedClusters, isAllClustersSelected, clusterInfoMap])

  // Check if we have real data (events with timestamps)
  const hasRealData = filteredEvents.length > 0 && filteredEvents.some(e => e.lastSeen || e.firstSeen)

  // Group events into time buckets
  const timeSeriesData = useMemo(() => {
    return groupEventsByTime(filteredEvents)
  }, [filteredEvents])

  // Calculate totals
  const totalWarnings = timeSeriesData.reduce((sum, d) => sum + d.warnings, 0)
  const totalNormal = timeSeriesData.reduce((sum, d) => sum + d.normal, 0)
  const peakEvents = Math.max(...timeSeriesData.map(d => d.total))

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading events...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-foreground">Events Timeline</span>
          {hasRealData && (
            <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
        </div>
        <RefreshIndicator
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          size="sm"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <span className="text-xs text-orange-400">Warnings</span>
          </div>
          <span className="text-lg font-bold text-foreground">{totalWarnings}</span>
        </div>
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Normal</span>
          </div>
          <span className="text-lg font-bold text-foreground">{totalNormal}</span>
        </div>
        <div className="p-2 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Peak</span>
          </div>
          <span className="text-lg font-bold text-foreground">{peakEvents}</span>
        </div>
      </div>

      {/* Stacked Area Chart */}
      <div className="flex-1 min-h-[160px]">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No events in the last hour
          </div>
        ) : (
          <div style={{ width: '100%', minHeight: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timeSeriesData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradientWarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientNormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={{ stroke: '#333' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#888' }}
              />
              <Area
                type="stepAfter"
                dataKey="warnings"
                stackId="1"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#gradientWarnings)"
                name="Warnings"
              />
              <Area
                type="stepAfter"
                dataKey="normal"
                stackId="1"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradientNormal)"
                name="Normal"
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/60" />
          <span className="text-muted-foreground">Warnings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/60" />
          <span className="text-muted-foreground">Normal</span>
        </div>
      </div>
    </div>
  )
}
