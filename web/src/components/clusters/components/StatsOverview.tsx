import { WifiOff, HardDrive, Server, CheckCircle2, XCircle, Cpu, MemoryStick, Layers, Zap, Box } from 'lucide-react'
import { formatStat, formatMemoryStat } from '../../../lib/formatStats'

export interface ClusterStats {
  total: number
  loading: number
  healthy: number
  unhealthy: number
  unreachable: number
  totalNodes: number
  totalCPUs: number
  totalMemoryGB: number
  totalStorageGB: number
  totalPods: number
  totalGPUs: number
  allocatedGPUs: number
  /** Whether there are any reachable clusters with resource data */
  hasResourceData?: boolean
}

interface StatsOverviewProps {
  stats: ClusterStats
  /** Filter cluster list to show only clusters with the given status */
  onFilterByStatus?: (status: 'all' | 'healthy' | 'unhealthy' | 'unreachable') => void
  /** Open CPU detail modal */
  onCPUClick?: () => void
  /** Open Memory detail modal */
  onMemoryClick?: () => void
  /** Open Storage detail modal */
  onStorageClick?: () => void
  /** Open GPU detail modal */
  onGPUClick?: () => void
  /** Navigate to nodes view */
  onNodesClick?: () => void
  /** Navigate to pods view */
  onPodsClick?: () => void
}

export function StatsOverview({ stats, onFilterByStatus, onCPUClick, onMemoryClick, onStorageClick, onGPUClick, onNodesClick, onPodsClick }: StatsOverviewProps) {
  // Resource data is available if we have reachable clusters with node data
  const hasData = stats.hasResourceData !== false

  return (
    <div className="grid grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
      {/* Row 1: Cluster health stats - always show these counts */}
      <div
        className={`glass p-4 rounded-lg ${onFilterByStatus ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => onFilterByStatus?.('all')}
        title={`${formatStat(stats.total)} total clusters${onFilterByStatus ? ' - Click to show all' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-5 h-5 shrink-0 text-purple-400" />
          <span className="text-sm text-muted-foreground truncate">Clusters</span>
        </div>
        <div className="text-3xl font-bold text-foreground">{formatStat(stats.total)}</div>
        <div className="text-xs text-muted-foreground">total</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onFilterByStatus && stats.healthy > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => stats.healthy > 0 && onFilterByStatus?.('healthy')}
        title={`${formatStat(stats.healthy)} healthy clusters${onFilterByStatus && stats.healthy > 0 ? ' - Click to filter' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
          <span className="text-sm text-muted-foreground truncate">Healthy</span>
        </div>
        <div className="text-3xl font-bold text-green-400">{formatStat(stats.healthy)}</div>
        <div className="text-xs text-muted-foreground">clusters</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onFilterByStatus && stats.unhealthy > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => stats.unhealthy > 0 && onFilterByStatus?.('unhealthy')}
        title={`${formatStat(stats.unhealthy)} unhealthy clusters${onFilterByStatus && stats.unhealthy > 0 ? ' - Click to filter' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="w-5 h-5 shrink-0 text-orange-400" />
          <span className="text-sm text-muted-foreground truncate">Unhealthy</span>
        </div>
        <div className="text-3xl font-bold text-orange-400">{formatStat(stats.unhealthy)}</div>
        <div className="text-xs text-muted-foreground">clusters</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onFilterByStatus && stats.unreachable > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => stats.unreachable > 0 && onFilterByStatus?.('unreachable')}
        title={`${formatStat(stats.unreachable)} offline clusters - check network connection${onFilterByStatus && stats.unreachable > 0 ? ' - Click to filter' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <WifiOff className="w-5 h-5 shrink-0 text-yellow-400" />
          <span className="text-sm text-muted-foreground truncate">Offline</span>
        </div>
        <div className="text-3xl font-bold text-yellow-400">{formatStat(stats.unreachable)}</div>
        <div className="text-xs text-muted-foreground">clusters</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onNodesClick && hasData && stats.totalNodes > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalNodes > 0 && onNodesClick?.()}
        title={hasData ? `${formatStat(stats.totalNodes)} total nodes${onNodesClick && stats.totalNodes > 0 ? ' - Click to view' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <Box className="w-5 h-5 shrink-0 text-cyan-400" />
          <span className="text-sm text-muted-foreground truncate">Nodes</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {hasData ? formatStat(stats.totalNodes) : '-'}
        </div>
        <div className="text-xs text-muted-foreground">total</div>
      </div>

      {/* Row 2: Resource metrics - show '-' if no data available */}
      <div
        className={`glass p-4 rounded-lg ${onCPUClick && hasData && stats.totalCPUs > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalCPUs > 0 && onCPUClick?.()}
        title={hasData ? `${formatStat(stats.totalCPUs)} CPU cores${onCPUClick && stats.totalCPUs > 0 ? ' - Click to view details' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-5 h-5 shrink-0 text-blue-400" />
          <span className="text-sm text-muted-foreground truncate">CPUs</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {hasData ? formatStat(stats.totalCPUs) : '-'}
        </div>
        <div className="text-xs text-muted-foreground">cores</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onMemoryClick && hasData && stats.totalMemoryGB > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalMemoryGB > 0 && onMemoryClick?.()}
        title={hasData ? `${formatMemoryStat(stats.totalMemoryGB, hasData)} memory${onMemoryClick && stats.totalMemoryGB > 0 ? ' - Click to view details' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <MemoryStick className="w-5 h-5 shrink-0 text-green-400" />
          <span className="text-sm text-muted-foreground truncate">Memory</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {formatMemoryStat(stats.totalMemoryGB, hasData)}
        </div>
        <div className="text-xs text-muted-foreground">allocatable</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onStorageClick && hasData && stats.totalStorageGB > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalStorageGB > 0 && onStorageClick?.()}
        title={hasData ? `${formatMemoryStat(stats.totalStorageGB, hasData)} ephemeral storage${onStorageClick && stats.totalStorageGB > 0 ? ' - Click to view details' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-5 h-5 shrink-0 text-purple-400" />
          <span className="text-sm text-muted-foreground truncate">Storage</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {formatMemoryStat(stats.totalStorageGB, hasData)}
        </div>
        <div className="text-xs text-muted-foreground">ephemeral</div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onGPUClick && hasData && stats.totalGPUs > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalGPUs > 0 && onGPUClick?.()}
        title={hasData ? `${formatStat(stats.totalGPUs)} total GPUs${stats.allocatedGPUs > 0 ? ` (${formatStat(stats.allocatedGPUs)} allocated)` : ''}${onGPUClick && stats.totalGPUs > 0 ? ' - Click to view details' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 shrink-0 text-yellow-400" />
          <span className="text-sm text-muted-foreground truncate">GPUs</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {hasData ? formatStat(stats.totalGPUs) : '-'}
        </div>
        <div className="text-xs text-muted-foreground">
          {hasData && stats.allocatedGPUs > 0 ? `${formatStat(stats.allocatedGPUs)} allocated` : 'total'}
        </div>
      </div>
      <div
        className={`glass p-4 rounded-lg ${onPodsClick && hasData && stats.totalPods > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
        onClick={() => hasData && stats.totalPods > 0 && onPodsClick?.()}
        title={hasData ? `${formatStat(stats.totalPods)} running pods${onPodsClick && stats.totalPods > 0 ? ' - Click to view' : ''}` : 'No data available'}
      >
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 shrink-0 text-purple-400" />
          <span className="text-sm text-muted-foreground truncate">Pods</span>
        </div>
        <div className="text-3xl font-bold text-foreground">
          {hasData ? formatStat(stats.totalPods) : '-'}
        </div>
        <div className="text-xs text-muted-foreground">running</div>
      </div>
    </div>
  )
}
