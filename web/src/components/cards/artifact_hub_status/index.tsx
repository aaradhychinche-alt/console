import { CheckCircle, AlertTriangle, Package, RefreshCw, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '../../ui/Skeleton'
import { useArtifactHubStatus } from './useArtifactHubStatus'

function useFormatRelativeTime() {
  const { t } = useTranslation('cards')
  return (isoString: string): string => {
    const diff = Date.now() - new Date(isoString).getTime()
    if (isNaN(diff) || diff < 0) return t('artifactHub.syncedJustNow')
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return t('artifactHub.syncedJustNow')
    if (diff < hour) return t('artifactHub.syncedMinutesAgo', { count: Math.floor(diff / minute) })
    if (diff < day) return t('artifactHub.syncedHoursAgo', { count: Math.floor(diff / hour) })
    return t('artifactHub.syncedDaysAgo', { count: Math.floor(diff / day) })
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface MetricTileProps {
  label: string
  value: string
  colorClass: string
}

function MetricTile({ label, value, colorClass }: MetricTileProps) {
  return (
    <div className="flex-1 p-3 rounded-lg bg-secondary/30 text-center">
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

export function ArtifactHubStatus() {
  const { t } = useTranslation('cards')
  const formatRelativeTime = useFormatRelativeTime()
  const { data, error, showSkeleton, showEmptyState } = useArtifactHubStatus()

  if (showSkeleton) {
    return (
      <div className="h-full flex flex-col min-h-card gap-3">
        <Skeleton variant="rounded" height={36} />
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={72} className="flex-1" />
          <Skeleton variant="rounded" height={72} className="flex-1" />
        </div>
        <Skeleton variant="rounded" height={40} />
      </div>
    )
  }

  if (error || showEmptyState) {
    return (
      <div className="h-full flex flex-col items-center justify-center min-h-card text-muted-foreground gap-2">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-red-400">{t('artifactHub.failedToReach')}</p>
        <p className="text-xs">{t('artifactHub.couldNotReach')}</p>
      </div>
    )
  }

  const isHealthy = data.health === 'healthy'

  return (
    <div className="h-full flex flex-col min-h-card content-loaded gap-4">
      {/* Status badge */}
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
          {isHealthy ? t('artifactHub.healthy') : t('artifactHub.degraded')}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>{formatRelativeTime(data.lastSyncTime)}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex gap-3">
        <MetricTile
          label={t('artifactHub.repositories')}
          value={formatNumber(data.repositoryCount)}
          colorClass="text-blue-400"
        />
        <MetricTile
          label={t('artifactHub.packages')}
          value={formatNumber(data.packageCount)}
          colorClass="text-purple-400"
        />
      </div>

      {/* Description */}
      <div className="flex-1 flex flex-col justify-end gap-3">
        <div className="p-3 rounded-lg bg-secondary/20 border border-border/30">
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('artifactHub.description')}
            </p>
          </div>
        </div>

        {/* Footer link */}
        <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <a
            href="https://artifacthub.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-blue-400 transition-colors"
          >
            {t('artifactHub.openArtifactHub')}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
