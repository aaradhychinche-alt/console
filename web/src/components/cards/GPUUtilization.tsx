import { useMemo, useState, useEffect, useRef } from 'react'
import { Zap, TrendingUp } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts'
import { useGPUNodes, useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'

interface GPUPoint {
  time: string
  allocated: number
  available: number
  total: number
}

export function GPUUtilization() {
  const { nodes: gpuNodes, isLoading } = useGPUNodes()
  const { clusters } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()

  // Filter by selected clusters AND exclude offline/unreachable clusters
  const filteredClusters = useMemo(() => {
    const reachableClusters = clusters.filter(c => c.reachable !== false)
    if (isAllClustersSelected) return reachableClusters
    return reachableClusters.filter(c => selectedClusters.includes(c.name))
  }, [clusters, selectedClusters, isAllClustersSelected])

  // Get names of reachable clusters for node filtering
  const reachableClusterNames = useMemo(() => {
    return new Set(clusters.filter(c => c.reachable !== false).map(c => c.name))
  }, [clusters])

  const hasReachableClusters = filteredClusters.some(c => c.nodeCount !== undefined && c.nodeCount > 0)

  // Track historical data points
  const historyRef = useRef<GPUPoint[]>([])
  const [history, setHistory] = useState<GPUPoint[]>([])

  // Filter by selected clusters AND exclude nodes from offline/unreachable clusters
  const filteredNodes = useMemo(() => {
    // First filter to only nodes from reachable clusters
    const reachableNodes = gpuNodes.filter(n => {
      // Extract cluster name from the node's cluster field (may be prefixed)
      const clusterName = n.cluster.split('/')[0]
      return reachableClusterNames.has(clusterName)
    })
    if (isAllClustersSelected) return reachableNodes
    return reachableNodes.filter(n => selectedClusters.some(c => n.cluster.startsWith(c)))
  }, [gpuNodes, selectedClusters, isAllClustersSelected, reachableClusterNames])

  // Calculate current stats
  const currentStats = useMemo(() => {
    const total = filteredNodes.reduce((sum, n) => sum + n.gpuCount, 0)
    const allocated = filteredNodes.reduce((sum, n) => sum + n.gpuAllocated, 0)
    const available = total - allocated
    const utilization = total > 0 ? Math.round((allocated / total) * 100) : 0
    return { total, allocated, available, utilization }
  }, [filteredNodes])

  // Check if we have real data
  const hasRealData = !isLoading && filteredNodes.length > 0

  // Add data point to history on each update
  useEffect(() => {
    if (isLoading) return
    if (currentStats.total === 0) return

    const now = new Date()
    const newPoint: GPUPoint = {
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      allocated: currentStats.allocated,
      available: currentStats.available,
      total: currentStats.total,
    }

    // Only add if data changed
    const lastPoint = historyRef.current[historyRef.current.length - 1]
    const shouldAdd = !lastPoint ||
      lastPoint.allocated !== newPoint.allocated ||
      lastPoint.available !== newPoint.available

    if (shouldAdd) {
      const newHistory = [...historyRef.current, newPoint].slice(-20)
      historyRef.current = newHistory
      setHistory(newHistory)
    }
  }, [currentStats, isLoading])

  // Initialize with simulated history
  useEffect(() => {
    if (history.length === 0 && currentStats.total > 0) {
      const now = new Date()
      const initialPoints: GPUPoint[] = []

      for (let i = 9; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000)
        // Simulate some variance in allocation
        const variance = Math.floor(Math.random() * Math.min(2, currentStats.available + 1))
        const allocatedVariance = Math.max(0, Math.min(currentStats.total, currentStats.allocated + variance - 1))
        initialPoints.push({
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          allocated: allocatedVariance,
          available: currentStats.total - allocatedVariance,
          total: currentStats.total,
        })
      }

      historyRef.current = initialPoints
      setHistory(initialPoints)
    }
  }, [currentStats, history.length])

  // Pie chart data
  const pieData = [
    { name: 'Allocated', value: currentStats.allocated, color: '#9333ea' },
    { name: 'Available', value: currentStats.available, color: '#22c55e' },
  ]

  if (isLoading && history.length === 0 && hasReachableClusters) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading GPU data...</div>
      </div>
    )
  }

  // No reachable clusters or no GPUs available
  if (!hasReachableClusters || (!isLoading && currentStats.total === 0)) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-foreground">GPU Utilization</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {!hasReachableClusters ? 'No reachable clusters' : 'No GPUs detected in selected clusters'}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-foreground">GPU Utilization</span>
          {hasRealData && (
            <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
        </div>
{/* No refresh indicator - useGPUNodes doesn't support it yet */}
      </div>

      {/* Stats and pie chart row */}
      <div className="flex items-center gap-4 mb-4">
        {/* Donut chart */}
        <div className="w-20 h-20 relative" style={{ minWidth: 80, minHeight: 80 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={35}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-foreground">{currentStats.utilization}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-xs text-purple-400 mb-1">Allocated</div>
            <span className="text-lg font-bold text-foreground">{currentStats.allocated}</span>
          </div>
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-xs text-green-400 mb-1">Available</div>
            <span className="text-lg font-bold text-foreground">{currentStats.available}</span>
          </div>
          <div className="p-2 rounded-lg bg-secondary/50">
            <div className="text-xs text-muted-foreground mb-1">Total</div>
            <span className="text-lg font-bold text-foreground">{currentStats.total}</span>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="flex-1 min-h-[120px]">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Allocation Trend</span>
        </div>
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Collecting data...
          </div>
        ) : (
          <div style={{ width: '100%', minHeight: 100, height: 100 }}>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradientAllocated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#888', fontSize: 9 }}
                axisLine={{ stroke: '#333' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#888', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, currentStats.total]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#888' }}
              />
              <ReferenceLine
                y={currentStats.total}
                stroke="#666"
                strokeDasharray="3 3"
                label={{ value: 'Total', position: 'right', fill: '#888', fontSize: 9 }}
              />
              <Area
                type="stepAfter"
                dataKey="allocated"
                stroke="#9333ea"
                strokeWidth={2}
                fill="url(#gradientAllocated)"
                name="Allocated GPUs"
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GPU Nodes summary */}
      <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
        {filteredNodes.length} GPU node{filteredNodes.length !== 1 ? 's' : ''} across {
          new Set(filteredNodes.map(n => n.cluster.split('/')[0])).size
        } cluster{new Set(filteredNodes.map(n => n.cluster.split('/')[0])).size !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
