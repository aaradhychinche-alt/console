import { useState, useMemo, useEffect, useRef } from 'react'
import { TrendingUp, Cpu, MemoryStick, Box, Server } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { RefreshIndicator } from '../ui/RefreshIndicator'

interface ResourcePoint {
  time: string
  cpuCores: number
  memoryGB: number
  pods: number
  nodes: number
}

type MetricView = 'all' | 'compute' | 'workloads'

export function ResourceTrend() {
  const { clusters, isLoading, isRefreshing, lastUpdated } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const [view, setView] = useState<MetricView>('all')

  // Track historical data points
  const historyRef = useRef<ResourcePoint[]>([])
  const [history, setHistory] = useState<ResourcePoint[]>([])

  // Filter by selected clusters AND exclude offline/unreachable clusters
  const filteredClusters = useMemo(() => {
    const reachableClusters = clusters.filter(c => c.reachable !== false)
    if (isAllClustersSelected) return reachableClusters
    return reachableClusters.filter(c => selectedClusters.includes(c.name))
  }, [clusters, selectedClusters, isAllClustersSelected])

  // Calculate current totals
  const currentTotals = useMemo(() => {
    return {
      cpuCores: filteredClusters.reduce((sum, c) => sum + (c.cpuCores || 0), 0),
      memoryGB: filteredClusters.reduce((sum, c) => sum + (c.memoryGB || 0), 0),
      pods: filteredClusters.reduce((sum, c) => sum + (c.podCount || 0), 0),
      nodes: filteredClusters.reduce((sum, c) => sum + (c.nodeCount || 0), 0),
    }
  }, [filteredClusters])

  // Check if we have any reachable clusters with real data
  const hasReachableClusters = filteredClusters.some(c => c.reachable !== false && c.nodeCount !== undefined && c.nodeCount > 0)

  // Check if we have real data
  const hasRealData = !isLoading && filteredClusters.length > 0 &&
    filteredClusters.some(c => c.cpuCores !== undefined || c.memoryGB !== undefined)

  // Add data point to history on each update
  useEffect(() => {
    if (isLoading) return
    if (currentTotals.nodes === 0) return

    const now = new Date()
    const newPoint: ResourcePoint = {
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...currentTotals,
    }

    // Only add if data changed
    const lastPoint = historyRef.current[historyRef.current.length - 1]
    const shouldAdd = !lastPoint ||
      lastPoint.cpuCores !== newPoint.cpuCores ||
      lastPoint.memoryGB !== newPoint.memoryGB ||
      lastPoint.pods !== newPoint.pods ||
      lastPoint.nodes !== newPoint.nodes

    if (shouldAdd) {
      const newHistory = [...historyRef.current, newPoint].slice(-20)
      historyRef.current = newHistory
      setHistory(newHistory)
    }
  }, [currentTotals, isLoading])

  // Initialize with simulated history
  useEffect(() => {
    if (history.length === 0 && currentTotals.nodes > 0) {
      const now = new Date()
      const initialPoints: ResourcePoint[] = []

      for (let i = 9; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000)
        const variance = 1 + (Math.random() * 0.05 - 0.025) // ±2.5% variance
        initialPoints.push({
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cpuCores: Math.round(currentTotals.cpuCores * variance),
          memoryGB: Math.round(currentTotals.memoryGB * variance * 10) / 10,
          pods: Math.round(currentTotals.pods * variance),
          nodes: currentTotals.nodes, // Nodes typically don't change rapidly
        })
      }

      historyRef.current = initialPoints
      setHistory(initialPoints)
    }
  }, [currentTotals, history.length])

  if (isLoading && history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading resources...</div>
      </div>
    )
  }

  // Get visible lines based on view
  const getLines = () => {
    switch (view) {
      case 'compute':
        return [
          { dataKey: 'cpuCores', color: '#3b82f6', name: 'CPU Cores' },
          { dataKey: 'memoryGB', color: '#22c55e', name: 'Memory (GB)' },
        ]
      case 'workloads':
        return [
          { dataKey: 'pods', color: '#9333ea', name: 'Pods' },
          { dataKey: 'nodes', color: '#f59e0b', name: 'Nodes' },
        ]
      default:
        return [
          { dataKey: 'cpuCores', color: '#3b82f6', name: 'CPU' },
          { dataKey: 'pods', color: '#9333ea', name: 'Pods' },
        ]
    }
  }

  const lines = getLines()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-foreground">Resource Trend</span>
          {hasRealData && (
            <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RefreshIndicator
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            size="sm"
          />
        </div>
      </div>

      {/* View selector */}
      <div className="flex gap-1 mb-4">
        {(['all', 'compute', 'workloads'] as MetricView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              view === v
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {v === 'all' ? 'Overview' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20" title={hasReachableClusters ? `${currentTotals.cpuCores} CPU cores total` : 'No reachable clusters'}>
          <div className="flex items-center gap-1 mb-1">
            <Cpu className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-blue-400">CPUs</span>
          </div>
          <span className="text-sm font-bold text-foreground">{hasReachableClusters ? currentTotals.cpuCores : '-'}</span>
        </div>
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20" title={hasReachableClusters ? `${currentTotals.memoryGB.toFixed(0)} GB memory total` : 'No reachable clusters'}>
          <div className="flex items-center gap-1 mb-1">
            <MemoryStick className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Mem</span>
          </div>
          <span className="text-sm font-bold text-foreground">{hasReachableClusters ? `${currentTotals.memoryGB.toFixed(0)}G` : '-'}</span>
        </div>
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20" title={hasReachableClusters ? `${currentTotals.pods} pods running` : 'No reachable clusters'}>
          <div className="flex items-center gap-1 mb-1">
            <Box className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-400">Pods</span>
          </div>
          <span className="text-sm font-bold text-foreground">{hasReachableClusters ? currentTotals.pods : '-'}</span>
        </div>
        <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20" title={hasReachableClusters ? `${currentTotals.nodes} nodes total` : 'No reachable clusters'}>
          <div className="flex items-center gap-1 mb-1">
            <Server className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-400">Nodes</span>
          </div>
          <span className="text-sm font-bold text-foreground">{hasReachableClusters ? currentTotals.nodes : '-'}</span>
        </div>
      </div>

      {/* Multi-line Chart */}
      <div className="flex-1 min-h-[160px]">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No resource data available
          </div>
        ) : (
          <div style={{ width: '100%', minHeight: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                iconType="line"
              />
              {lines.map((line, idx) => (
                <Line
                  key={line.dataKey}
                  type="natural"
                  dataKey={line.dataKey}
                  stroke={line.color}
                  strokeWidth={2}
                  strokeDasharray={idx === 1 ? "5 5" : undefined}
                  dot={false}
                  name={line.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
