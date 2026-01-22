import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { TimeSeriesChart } from '../charts'
import { useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { Server, Clock, Filter, ChevronDown } from 'lucide-react'
import { RefreshButton } from '../ui/RefreshIndicator'

type TimeRange = '15m' | '1h' | '6h' | '24h'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; points: number; intervalMs: number }[] = [
  { value: '15m', label: '15 min', points: 15, intervalMs: 60000 },
  { value: '1h', label: '1 hour', points: 20, intervalMs: 180000 },
  { value: '6h', label: '6 hours', points: 24, intervalMs: 900000 },
  { value: '24h', label: '24 hours', points: 24, intervalMs: 3600000 },
]


type MetricType = 'cpu' | 'memory' | 'pods' | 'nodes'

const metricConfig = {
  cpu: { label: 'CPU Cores', color: '#9333ea', unit: '', baseValue: 65, variance: 30 },
  memory: { label: 'Memory', color: '#3b82f6', unit: ' GB', baseValue: 72, variance: 20 },
  pods: { label: 'Pods', color: '#10b981', unit: '', baseValue: 150, variance: 100 },
  nodes: { label: 'Nodes', color: '#f59e0b', unit: '', baseValue: 10, variance: 5 },
}

interface MetricPoint {
  time: string
  timestamp: number
  cpu: number
  memory: number
  pods: number
  nodes: number
}

const STORAGE_KEY = 'cluster-metrics-history'
const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes TTL

export function ClusterMetrics() {
  const { clusters: rawClusters, isLoading, isRefreshing, refetch, isFailed, consecutiveFailures, lastRefresh } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('cpu')
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [localClusterFilter, setLocalClusterFilter] = useState<string[]>([])
  const [showClusterFilter, setShowClusterFilter] = useState(false)
  const clusterFilterRef = useRef<HTMLDivElement>(null)

  // Load history from localStorage
  const loadSavedHistory = useCallback((): MetricPoint[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { data: MetricPoint[]; timestamp: number }
        if (Date.now() - parsed.timestamp < MAX_AGE_MS) {
          return parsed.data
        }
      }
    } catch {
      // Ignore parse errors
    }
    return []
  }, [])

  const historyRef = useRef<MetricPoint[]>(loadSavedHistory())
  const [history, setHistory] = useState<MetricPoint[]>(historyRef.current)

  // Save history to localStorage when it changes
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          data: history,
          timestamp: Date.now(),
        }))
      } catch {
        // Ignore storage errors
      }
    }
  }, [history])

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

  // Get reachable clusters
  const reachableClusters = useMemo(() => {
    return rawClusters.filter(c => c.reachable !== false)
  }, [rawClusters])

  // Filter clusters based on global selection AND local filter AND exclude offline/unreachable clusters
  const clusters = useMemo(() => {
    let filtered = reachableClusters
    if (!isAllClustersSelected) {
      filtered = filtered.filter(c => selectedClusters.includes(c.name))
    }
    // Apply local cluster filter if any selected
    if (localClusterFilter.length > 0) {
      filtered = filtered.filter(c => localClusterFilter.includes(c.name))
    }
    return filtered
  }, [reachableClusters, selectedClusters, isAllClustersSelected, localClusterFilter])

  // Get available clusters for local filter (respects global filter)
  const availableClustersForFilter = useMemo(() => {
    if (isAllClustersSelected) return reachableClusters
    return reachableClusters.filter(c => selectedClusters.includes(c.name))
  }, [reachableClusters, selectedClusters, isAllClustersSelected])

  // Calculate real current values from cluster data
  const realValues = useMemo(() => {
    const totalCPUs = clusters.reduce((sum, c) => sum + (c.cpuCores || 0), 0)
    const totalMemoryGB = clusters.reduce((sum, c) => sum + (c.memoryGB || 0), 0)
    const totalPods = clusters.reduce((sum, c) => sum + (c.podCount || 0), 0)
    const totalNodes = clusters.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
    return { cpu: totalCPUs, memory: totalMemoryGB, pods: totalPods, nodes: totalNodes }
  }, [clusters])

  // Check if we have real data
  const hasRealData = clusters.some(c => c.cpuCores !== undefined || c.memoryGB !== undefined)

  // Track data points over time - add new point when values change
  useEffect(() => {
    if (isLoading || !hasRealData) return
    if (realValues.nodes === 0 && realValues.cpu === 0) return

    const now = Date.now()
    const newPoint: MetricPoint = {
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: now,
      cpu: realValues.cpu,
      memory: realValues.memory,
      pods: realValues.pods,
      nodes: realValues.nodes,
    }

    // Only add if data changed or at least 30 seconds since last point
    const lastPoint = historyRef.current[historyRef.current.length - 1]
    const shouldAdd = !lastPoint ||
      (now - lastPoint.timestamp > 30000) ||
      lastPoint.cpu !== newPoint.cpu ||
      lastPoint.memory !== newPoint.memory ||
      lastPoint.pods !== newPoint.pods ||
      lastPoint.nodes !== newPoint.nodes

    if (shouldAdd) {
      // Keep last 60 points (about 30 minutes at 30-second intervals)
      const newHistory = [...historyRef.current, newPoint].slice(-60)
      historyRef.current = newHistory
      setHistory(newHistory)
    }
  }, [realValues, isLoading, hasRealData])

  // Transform history to chart data for selected metric
  const data = useMemo(() => {
    // Filter history based on time range
    const now = Date.now()
    const rangeMs = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    }[timeRange]

    const filteredHistory = history.filter(p => now - p.timestamp <= rangeMs)

    return filteredHistory.map(point => ({
      time: point.time,
      value: point[selectedMetric],
    }))
  }, [history, selectedMetric, timeRange])

  const config = metricConfig[selectedMetric]
  // Use real current value if available, otherwise use last chart value
  const currentValue = hasRealData ? realValues[selectedMetric] : (data[data.length - 1]?.value || 0)

  const toggleClusterFilter = (clusterName: string) => {
    setLocalClusterFilter(prev => {
      if (prev.includes(clusterName)) {
        return prev.filter(c => c !== clusterName)
      }
      return [...prev, clusterName]
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with metric selector */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground">{config.label}</h4>
            {clusters.length < availableClustersForFilter.length && clusters.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                <Server className="w-3 h-3" />
                {clusters.length}/{availableClustersForFilter.length}
              </span>
            )}
            {hasRealData && (
              <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                Live
              </span>
            )}
            <RefreshButton
              isRefreshing={isRefreshing}
              isFailed={isFailed}
              consecutiveFailures={consecutiveFailures}
              lastRefresh={lastRefresh}
              onRefresh={refetch}
              size="sm"
            />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {selectedMetric === 'memory' ? realValues.memory.toFixed(1) : Math.round(currentValue)}<span className="text-sm text-muted-foreground">{config.unit}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {(Object.keys(metricConfig) as MetricType[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedMetric === key
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {metricConfig[key].label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-2 mb-3">
        {/* Time Range Filter */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-2 py-1 text-xs rounded-lg bg-secondary border border-border text-foreground cursor-pointer"
            title="Select time range"
          >
            {TIME_RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

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
              <span>{localClusterFilter.length > 0 ? `${localClusterFilter.length} clusters` : 'All clusters'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showClusterFilter && (
              <div className="absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-lg bg-card border border-border shadow-lg z-50">
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
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[160px]">
        {clusters.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No clusters selected
          </div>
        ) : data.length < 2 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Clock className="w-5 h-5" />
            <span>{data.length === 0 ? 'Collecting data...' : 'Waiting for next data point...'}</span>
            <span className="text-xs text-muted-foreground/70">Chart will appear after collecting more data</span>
          </div>
        ) : (
          <TimeSeriesChart
            data={data}
            color={config.color}
            height={160}
            unit={config.unit}
            showGrid
          />
        )}
      </div>

      {/* Stats - show when we have time series data */}
      {data.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-sm font-medium text-foreground">
              {Math.round(Math.min(...data.map((d) => d.value)))}{config.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg</p>
            <p className="text-sm font-medium text-foreground">
              {Math.round(data.reduce((a, b) => a + b.value, 0) / data.length)}{config.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-sm font-medium text-foreground">
              {Math.round(Math.max(...data.map((d) => d.value)))}{config.unit}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
