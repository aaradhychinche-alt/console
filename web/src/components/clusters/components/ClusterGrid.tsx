import { Pencil, Loader2, Globe, User, ShieldAlert, ChevronRight, Star, WifiOff, RefreshCw } from 'lucide-react'
import { ClusterInfo } from '../../../hooks/useMCP'
import { StatusIndicator } from '../../charts/StatusIndicator'
import { isClusterUnreachable, isClusterLoading } from '../utils'

interface GPUInfo {
  total: number
  allocated: number
}

interface ClusterGridProps {
  clusters: ClusterInfo[]
  gpuByCluster: Record<string, GPUInfo>
  isConnected: boolean
  permissionsLoading: boolean
  isClusterAdmin: (clusterName: string) => boolean
  onSelectCluster: (clusterName: string) => void
  onRenameCluster: (clusterName: string) => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function ClusterGrid({
  clusters,
  gpuByCluster,
  isConnected,
  permissionsLoading,
  isClusterAdmin,
  onSelectCluster,
  onRenameCluster,
  onRefresh,
  isRefreshing,
}: ClusterGridProps) {
  if (clusters.length === 0) {
    return (
      <div className="text-center py-12 mb-6">
        <p className="text-muted-foreground">No clusters match the current filter</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {clusters.map((cluster) => {
        const clusterKey = cluster.name.split('/')[0]
        const gpuInfo = gpuByCluster[clusterKey] || gpuByCluster[cluster.name]
        const loading = isClusterLoading(cluster)
        const unreachable = isClusterUnreachable(cluster)

        // Determine status: loading > unreachable > healthy
        const status = loading ? 'loading' : unreachable ? 'warning' : 'healthy'

        return (
          <div
            key={cluster.name}
            onClick={() => onSelectCluster(cluster.name)}
            className={`glass p-5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/50 border ${
              unreachable ? 'border-yellow-500/30' : 'border-transparent'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <StatusIndicator status={status} size="lg" showLabel={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">
                      {cluster.context || cluster.name.split('/').pop()}
                    </h3>
                    {isConnected && (cluster.source === 'kubeconfig' || !cluster.source) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRenameCluster(cluster.name) }}
                        className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground flex-shrink-0"
                        title="Rename context"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* Server and User with icons */}
                  <div className="flex flex-col gap-1 mt-1">
                    {cluster.server && (
                      <span
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default truncate max-w-[220px]"
                        title={`Server: ${cluster.server}`}
                      >
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{cluster.server.replace(/^https?:\/\//, '')}</span>
                      </span>
                    )}
                    {cluster.user && (
                      <span
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default truncate max-w-[220px]"
                        title={`User: ${cluster.user}`}
                      >
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{cluster.user}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-1 flex-shrink-0">
                {cluster.isCurrent && (
                  <span
                    className="flex items-center px-1.5 py-0.5 rounded bg-primary/20 text-primary"
                    title="Current kubectl context"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </span>
                )}
                {unreachable && (
                  <div className="flex items-center gap-1">
                    <span
                      className="flex items-center px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400"
                      title="Unreachable - check network connection"
                    >
                      <WifiOff className="w-3.5 h-3.5" />
                    </span>
                    {onRefresh && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRefresh()
                        }}
                        className="flex items-center px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                        title="Retry connection"
                        disabled={isRefreshing}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                )}
                {!permissionsLoading && !isClusterAdmin(cluster.name) && !unreachable && (
                  <span
                    className="flex items-center px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400"
                    title="You have limited permissions on this cluster"
                    data-testid="permission-badge"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center">
              <div title={loading ? 'Checking...' : unreachable ? 'Unreachable - check network connection' : `${cluster.nodeCount || 0} worker nodes`}>
                <div className="text-lg font-bold text-foreground">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : unreachable ? '-' : (cluster.nodeCount || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Nodes</div>
              </div>
              <div title={loading ? 'Checking...' : unreachable ? 'Unreachable - check network connection' : `${cluster.cpuCores || 0} CPU cores`}>
                <div className="text-lg font-bold text-foreground">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : unreachable ? '-' : (cluster.cpuCores || 0)}
                </div>
                <div className="text-xs text-muted-foreground">CPUs</div>
              </div>
              <div title={loading ? 'Checking...' : unreachable ? 'Unreachable - check network connection' : `${cluster.podCount || 0} running pods`}>
                <div className="text-lg font-bold text-foreground">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : unreachable ? '-' : (cluster.podCount || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Pods</div>
              </div>
              <div title={loading ? 'Checking...' : unreachable ? 'Unreachable - check network connection' : gpuInfo ? `${gpuInfo.allocated} allocated / ${gpuInfo.total} total GPUs` : 'No GPUs'}>
                <div className="text-lg font-bold text-foreground">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : unreachable ? '-' : (gpuInfo ? `${gpuInfo.allocated}/${gpuInfo.total}` : '0')}
                </div>
                <div className="text-xs text-muted-foreground">GPUs</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Source: {cluster.source || 'kubeconfig'}</span>
                <span title="View details"><ChevronRight className="w-4 h-4 text-primary" /></span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
