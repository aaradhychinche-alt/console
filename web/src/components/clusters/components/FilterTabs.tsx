import { WifiOff, SortAsc, SortDesc } from 'lucide-react'
import { ClusterStats } from './StatsOverview'

export type FilterType = 'all' | 'healthy' | 'unhealthy' | 'unreachable'
export type SortByType = 'name' | 'nodes' | 'pods' | 'health'

interface FilterTabsProps {
  stats: ClusterStats
  filter: FilterType
  onFilterChange: (filter: FilterType) => void
  sortBy: SortByType
  onSortByChange: (sortBy: SortByType) => void
  sortAsc: boolean
  onSortAscChange: (asc: boolean) => void
}

export function FilterTabs({
  stats,
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  sortAsc,
  onSortAscChange,
}: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onFilterChange('all')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          filter === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card/50 text-muted-foreground hover:text-foreground'
        }`}
      >
        All ({stats.total})
      </button>
      <button
        onClick={() => onFilterChange('healthy')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          filter === 'healthy'
            ? 'bg-green-500 text-foreground'
            : 'bg-card/50 text-muted-foreground hover:text-foreground'
        }`}
      >
        Healthy ({stats.healthy})
      </button>
      <button
        onClick={() => onFilterChange('unhealthy')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          filter === 'unhealthy'
            ? 'bg-orange-500 text-foreground'
            : 'bg-card/50 text-muted-foreground hover:text-foreground'
        }`}
      >
        Unhealthy ({stats.unhealthy})
      </button>
      <button
        onClick={() => onFilterChange('unreachable')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          filter === 'unreachable'
            ? 'bg-yellow-500 text-foreground'
            : 'bg-card/50 text-muted-foreground hover:text-foreground'
        }`}
        title="Clusters that cannot be contacted - check network connection"
      >
        <WifiOff className="w-3.5 h-3.5" />
        Offline ({stats.unreachable})
      </button>

      {/* Sort selector */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as SortByType)}
          className="px-2 py-1.5 rounded-lg text-sm bg-card/50 border border-border text-foreground"
        >
          <option value="name">Name</option>
          <option value="nodes">Nodes</option>
          <option value="pods">Pods</option>
          <option value="health">Health</option>
        </select>
        <button
          onClick={() => onSortAscChange(!sortAsc)}
          className="p-1.5 rounded-lg bg-card/50 border border-border text-muted-foreground hover:text-foreground"
          title={sortAsc ? 'Ascending' : 'Descending'}
        >
          {sortAsc ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
