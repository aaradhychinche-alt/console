import { CheckCircle, AlertTriangle, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '../../ui/Skeleton'
import { useMetal3Status } from './useMetal3Status'

function useFormatRelativeTime() {
  const { t } = useTranslation('cards')
  return (isoString: string): string => {
    const diff = Date.now() - new Date(isoString).getTime()
    if (isNaN(diff) || diff < 0) return t('metal3.syncedJustNow')
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return t('metal3.syncedJustNow')
    if (diff < hour) return t('metal3.syncedMinutesAgo', { count: Math.floor(diff / minute) })
    if (diff < day) return t('metal3.syncedHoursAgo', { count: Math.floor(diff / hour) })
    return t('metal3.syncedDaysAgo', { count: Math.floor(diff / day) })
  }
}

interface MetricTileProps {
  label: string
  value: number | string
  colorClass: string
  icon: React.ReactNode
}

function MetricTile({ label, value, colorClass, icon }: MetricTileProps) {
  return (
    <div className="flex-1 p-3 rounded-lg bg-secondary/30 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
      </div>
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

export function Metal3Status() {
  const { t } = useTranslation('cards')
  const formatRelativeTime = useFormatRelativeTime()
  const { data, error, showSkeleton, showEmptyState } = useMetal3Status()

  if (showSkeleton) {
    return (
      <div className="h-full flex flex-col min-h-card gap-3">
        <Skeleton variant="rounded" height={36} />
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={80} className="flex-1" />
          <Skeleton variant="rounded" height={80} className="flex-1" />
        </div>
        <Skeleton variant="rounded" height={60} />
        <Skeleton variant="rounded" height={40} />
      </div>
    )
  }

  if (error || showEmptyState) {
    return (
      <div className="h-full flex flex-col items-center justify-center min-h-card text-muted-foreground gap-2">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-red-400">
          {error ? t('metal3.fetchError') : t('metal3.noHosts')}
        </p>
        <p className="text-xs">{t('metal3.noHostsHint')}</p>
      </div>
    )
  }

  const isHealthy = data.health === 'healthy'
  const { provisioned, provisioning, deprovisioned, available, error: errHosts } = data.provisioningStates

  return (
    <div className="h-full flex flex-col min-h-card content-loaded gap-4">
      {/* Health badge + last updated */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isHealthy
              ? 'bg-green-500/15 text-green-400'
              : 'bg-orange-500/15 text-orange-400'
          }`}
        >
          {isHealthy ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {isHealthy ? t('metal3.healthy') : t('metal3.degraded')}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>{formatRelativeTime(data.lastUpdated)}</span>
        </div>
      </div>

      {/* BMC reachability tiles */}
      <div className="flex gap-3">
        <MetricTile
          label={t('metal3.totalHosts')}
          value={data.totalHosts}
          colorClass="text-blue-400"
          icon={<Server className="w-4 h-4 text-blue-400" />}
        />
        <MetricTile
          label={t('metal3.bmcReachable')}
          value={data.bmcReachable}
          colorClass="text-green-400"
          icon={<Wifi className="w-4 h-4 text-green-400" />}
        />
        <MetricTile
          label={t('metal3.bmcUnreachable')}
          value={data.bmcUnreachable}
          colorClass={data.bmcUnreachable > 0 ? 'text-red-400' : 'text-green-400'}
          icon={<WifiOff className={`w-4 h-4 ${data.bmcUnreachable > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />}
        />
      </div>

      {/* Provisioning state breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('metal3.provisioningStates')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t('metal3.stateProvisioned'), value: provisioned, color: 'text-green-400' },
            { label: t('metal3.stateProvisioning'), value: provisioning, color: provisioning > 0 ? 'text-yellow-400' : 'text-muted-foreground' },
            { label: t('metal3.stateAvailable'), value: available, color: 'text-blue-400' },
            { label: t('metal3.stateDeprovisioned'), value: deprovisioned, color: 'text-muted-foreground' },
            { label: t('metal3.stateError'), value: errHosts, color: errHosts > 0 ? 'text-red-400' : 'text-muted-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between px-2 py-1 rounded bg-secondary/20">
              <span className="text-xs text-muted-foreground truncate">{label}</span>
              <span className={`text-xs font-semibold ml-2 shrink-0 ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
