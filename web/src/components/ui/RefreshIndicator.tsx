import { Hourglass, Clock } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatLastSeen } from '../../lib/errorClassifier'

interface RefreshIndicatorProps {
  isRefreshing: boolean
  lastUpdated?: Date | null
  className?: string
  size?: 'xs' | 'sm' | 'md'
  showLabel?: boolean
  staleThresholdMinutes?: number
}

/**
 * Visual indicator for refresh state with last updated time
 *
 * States:
 * - Idle: Shows clock icon with "Updated Xs ago"
 * - Refreshing: Shows hourglass icon with "Updating" label
 * - Stale: Shows amber clock icon with warning styling
 */
export function RefreshIndicator({
  isRefreshing,
  lastUpdated,
  className,
  size = 'sm',
  showLabel = true,
  staleThresholdMinutes = 5,
}: RefreshIndicatorProps) {
  const isStale = lastUpdated &&
    (Date.now() - lastUpdated.getTime()) > staleThresholdMinutes * 60 * 1000

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const textSize = size === 'xs' ? 'text-[9px]' : size === 'sm' ? 'text-[10px]' : 'text-xs'

  const tooltip = lastUpdated
    ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
    : 'Not yet updated'

  if (isRefreshing) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-muted-foreground',
          textSize,
          className
        )}
        title="Updating..."
      >
        <Hourglass className={cn(iconSize, 'animate-pulse')} />
        {showLabel && <span>Updating</span>}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        isStale ? 'text-amber-400' : 'text-muted-foreground',
        textSize,
        className
      )}
      title={tooltip}
    >
      <Clock className={iconSize} />
      {showLabel && (
        <span>
          {lastUpdated ? formatLastSeen(lastUpdated) : 'pending'}
        </span>
      )}
    </span>
  )
}
