import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { HardDrive, Database, FolderArchive, Plus, Layout, LayoutGrid, ChevronDown, ChevronRight, RefreshCw, Activity, Hourglass, X, ExternalLink } from 'lucide-react'
import { useClusters, usePVCs, PVC } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useShowCards } from '../../hooks/useShowCards'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { Skeleton } from '../ui/Skeleton'
import { CardWrapper } from '../cards/CardWrapper'
import { CARD_COMPONENTS } from '../cards/cardRegistry'
import { AddCardModal } from '../dashboard/AddCardModal'
import { TemplatesModal } from '../dashboard/TemplatesModal'
import { ConfigureCardModal } from '../dashboard/ConfigureCardModal'
import { DashboardTemplate } from '../dashboard/templates'
import { ClusterBadge } from '../ui/ClusterBadge'

// PVC List Modal
interface PVCListModalProps {
  isOpen: boolean
  onClose: () => void
  pvcs: PVC[]
  title: string
  statusFilter?: 'Bound' | 'Pending' | 'all'
  onSelectPVC: (cluster: string, namespace: string, name: string) => void
}

function PVCListModal({ isOpen, onClose, pvcs, title, statusFilter = 'all', onSelectPVC }: PVCListModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Filter by status and search query
  const filteredPVCs = pvcs.filter(pvc => {
    if (statusFilter !== 'all' && pvc.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        pvc.name.toLowerCase().includes(query) ||
        pvc.namespace.toLowerCase().includes(query) ||
        (pvc.cluster && pvc.cluster.toLowerCase().includes(query)) ||
        (pvc.storageClass && pvc.storageClass.toLowerCase().includes(query))
      )
    }
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bound': return 'text-green-400 bg-green-400/20'
      case 'Pending': return 'text-yellow-400 bg-yellow-400/20'
      case 'Lost': return 'text-red-400 bg-red-400/20'
      default: return 'text-muted-foreground bg-secondary'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-lg w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Database className={`w-5 h-5 ${statusFilter === 'Bound' ? 'text-green-400' : statusFilter === 'Pending' ? 'text-yellow-400' : 'text-blue-400'}`} />
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
              {filteredPVCs.length} PVC{filteredPVCs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <input
            type="text"
            placeholder="Search by name, namespace, cluster, or storage class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* PVC List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPVCs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No PVCs found matching the criteria
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPVCs.map((pvc, idx) => (
                <div
                  key={`${pvc.cluster}-${pvc.namespace}-${pvc.name}-${idx}`}
                  onClick={() => onSelectPVC(pvc.cluster || 'default', pvc.namespace, pvc.name)}
                  className="glass p-3 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{pvc.name}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(pvc.status)}`}>
                            {pvc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>Namespace: {pvc.namespace}</span>
                          {pvc.storageClass && <span>• Storage Class: {pvc.storageClass}</span>}
                          {pvc.capacity && <span>• {pvc.capacity}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pvc.cluster && <ClusterBadge cluster={pvc.cluster} size="sm" />}
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface StorageCard {
  id: string
  card_type: string
  config: Record<string, unknown>
  title?: string
  position?: { w: number; h: number }
}

const STORAGE_CARDS_KEY = 'kubestellar-storage-cards'

function loadStorageCards(): StorageCard[] {
  try {
    const stored = localStorage.getItem(STORAGE_CARDS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveStorageCards(cards: StorageCard[]) {
  localStorage.setItem(STORAGE_CARDS_KEY, JSON.stringify(cards))
}

export function Storage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { clusters, isLoading, isRefreshing, lastUpdated, refetch } = useClusters()
  const {
    selectedClusters: globalSelectedClusters,
    isAllClustersSelected,
  } = useGlobalFilters()
  const { pvcs } = usePVCs()
  const { drillToPVC, drillToResources } = useDrillDownActions()

  // Card state
  const [cards, setCards] = useState<StorageCard[]>(() => loadStorageCards())
  const [showStats, setShowStats] = useState(true)
  const { showCards, setShowCards, expandCards } = useShowCards('kubestellar-storage')
  const [showAddCard, setShowAddCard] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [configuringCard, setConfiguringCard] = useState<StorageCard | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  // PVC List Modal state
  const [showPVCModal, setShowPVCModal] = useState(false)
  const [pvcModalFilter, setPVCModalFilter] = useState<'Bound' | 'Pending' | 'all'>('all')

  // Combined loading/refreshing states (useClusters has shared cache so data persists)
  const isFetching = isLoading || isRefreshing
  // Only show skeletons when we have no data yet
  const showSkeletons = clusters.length === 0 && isLoading

  // Save cards to localStorage when they change
  useEffect(() => {
    saveStorageCards(cards)
  }, [cards])

  // Handle addCard URL param - open modal and clear param
  useEffect(() => {
    if (searchParams.get('addCard') === 'true') {
      setShowAddCard(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Trigger refresh when navigating to this page (location.key changes on each navigation)
  useEffect(() => {
    refetch()
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refetch()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, refetch])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleAddCards = useCallback((newCards: Array<{ type: string; title: string; config: Record<string, unknown> }>) => {
    const cardsToAdd: StorageCard[] = newCards.map(card => ({
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      card_type: card.type,
      config: card.config,
      title: card.title,
    }))
    setCards(prev => [...prev, ...cardsToAdd])
    expandCards()
    setShowAddCard(false)
  }, [expandCards])

  const handleRemoveCard = useCallback((cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId))
  }, [])

  const handleConfigureCard = useCallback((cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (card) setConfiguringCard(card)
  }, [cards])

  const handleSaveCardConfig = useCallback((cardId: string, config: Record<string, unknown>) => {
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, config } : c
    ))
    setConfiguringCard(null)
  }, [])

  const handleWidthChange = useCallback((cardId: string, newWidth: number) => {
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, position: { ...(c.position || { w: 4, h: 2 }), w: newWidth } } : c
    ))
  }, [])

  const applyTemplate = useCallback((template: DashboardTemplate) => {
    const newCards: StorageCard[] = template.cards.map(card => ({
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      card_type: card.card_type,
      config: card.config || {},
      title: card.title,
    }))
    setCards(newCards)
    expandCards()
    setShowTemplates(false)
  }, [])

  // Filter clusters based on global selection
  const filteredClusters = clusters.filter(c =>
    isAllClustersSelected || globalSelectedClusters.includes(c.name)
  )

  // Reachable clusters are those not explicitly marked as unreachable
  const reachableClusters = filteredClusters.filter(c => c.reachable !== false)

  // Filter PVCs by global selection (only from reachable clusters)
  const filteredPVCs = pvcs.filter(p =>
    isAllClustersSelected || (p.cluster && globalSelectedClusters.includes(p.cluster))
  ).filter(p => {
    const cluster = clusters.find(c => c.name === p.cluster)
    return cluster?.reachable !== false
  })

  // Calculate storage stats from reachable clusters only
  const currentStats = {
    totalStorageGB: reachableClusters.reduce((sum, c) => sum + (c.storageGB || 0), 0),
    totalPVCs: filteredPVCs.length,
    boundPVCs: filteredPVCs.filter(p => p.status === 'Bound').length,
    pendingPVCs: filteredPVCs.filter(p => p.status === 'Pending').length,
  }

  // Check if we have actual data (not just loading state)
  const hasActualData = filteredClusters.some(c =>
    c.reachable !== false && c.storageGB !== undefined && c.nodeCount !== undefined && c.nodeCount > 0
  )

  // Cache the last known good stats to show during refresh
  const cachedStats = useRef(currentStats)

  // Update cache when we have real data
  useEffect(() => {
    if (hasActualData && (currentStats.totalStorageGB > 0 || currentStats.totalPVCs > 0)) {
      cachedStats.current = currentStats
    }
  }, [hasActualData, currentStats.totalStorageGB, currentStats.totalPVCs, currentStats.boundPVCs, currentStats.pendingPVCs])

  // Use cached stats during refresh, current stats when data is available
  const stats = (hasActualData || cachedStats.current.totalStorageGB > 0 || cachedStats.current.totalPVCs > 0)
    ? (hasActualData ? currentStats : cachedStats.current)
    : null

  // Determine if we should show data or dashes
  const hasDataToShow = stats !== null

  // Format storage size - returns '-' if no data, never negative
  const formatStorage = (gb: number, hasData = true) => {
    if (!hasData) return '-'
    const safeValue = Math.max(0, gb) // Never show negative
    if (safeValue >= 1024) {
      return `${(safeValue / 1024).toFixed(1)} TB`
    }
    return `${Math.round(safeValue)} GB`
  }

  // Format stat value - returns '-' if no data
  const formatStatValue = (value: number, hasData = true) => {
    if (!hasData) return '-'
    return Math.max(0, value)
  }

  // Transform card for ConfigureCardModal
  const configureCard = configuringCard ? {
    id: configuringCard.id,
    card_type: configuringCard.card_type,
    config: configuringCard.config,
    title: configuringCard.title,
  } : null

  return (
    <div className="pt-16">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <HardDrive className="w-6 h-6 text-purple-400" />
                Storage
              </h1>
              <p className="text-muted-foreground">Monitor storage resources across clusters</p>
            </div>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-xs text-amber-400 animate-pulse" title="Updating...">
                <Hourglass className="w-3 h-3" />
                <span>Updating</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="storage-auto-refresh" className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground" title="Auto-refresh every 30s">
              <input
                type="checkbox"
                id="storage-auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-border w-3.5 h-3.5"
              />
              Auto
            </label>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview - collapsible */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Activity className="w-4 h-4" />
            <span>Stats Overview</span>
            {showStats ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground/60">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {showSkeletons ? (
              // Loading skeletons
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="glass p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton variant="circular" width={20} height={20} />
                      <Skeleton variant="text" width={80} height={16} />
                    </div>
                    <Skeleton variant="text" width={60} height={36} className="mb-1" />
                    <Skeleton variant="text" width={100} height={12} />
                  </div>
                ))}
              </>
            ) : (
              // Real data - use cached stats during refresh
              <>
                <div
                  className={`glass p-4 rounded-lg ${hasDataToShow ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
                  onClick={hasDataToShow ? drillToResources : undefined}
                  title={hasDataToShow ? `${formatStorage(stats?.totalStorageGB || 0, hasDataToShow)} ephemeral storage allocatable across ${reachableClusters.length} cluster${reachableClusters.length !== 1 ? 's' : ''} - Click to view resources` : 'No reachable clusters'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-muted-foreground">Ephemeral Storage</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">{formatStorage(stats?.totalStorageGB || 0, hasDataToShow)}</div>
                  <div className="text-xs text-muted-foreground">total allocatable</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${hasDataToShow && (stats?.totalPVCs || 0) > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
                  onClick={() => {
                    if (hasDataToShow && (stats?.totalPVCs || 0) > 0) {
                      setPVCModalFilter('all')
                      setShowPVCModal(true)
                    }
                  }}
                  title={!hasDataToShow ? 'No reachable clusters' : (stats?.totalPVCs || 0) > 0 ? `${stats?.totalPVCs} persistent volume claim${(stats?.totalPVCs || 0) !== 1 ? 's' : ''} - Click to view list` : 'No PVCs found'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-muted-foreground">PVCs</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">{formatStatValue(stats?.totalPVCs || 0, hasDataToShow)}</div>
                  <div className="text-xs text-muted-foreground">persistent volume claims</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${hasDataToShow && (stats?.boundPVCs || 0) > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
                  onClick={() => {
                    if (hasDataToShow && (stats?.boundPVCs || 0) > 0) {
                      setPVCModalFilter('Bound')
                      setShowPVCModal(true)
                    }
                  }}
                  title={!hasDataToShow ? 'No reachable clusters' : (stats?.boundPVCs || 0) > 0 ? `${stats?.boundPVCs} PVC${(stats?.boundPVCs || 0) !== 1 ? 's' : ''} bound - Click to view list` : 'No bound PVCs'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderArchive className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-muted-foreground">Bound</span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">{formatStatValue(stats?.boundPVCs || 0, hasDataToShow)}</div>
                  <div className="text-xs text-muted-foreground">PVCs bound</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${hasDataToShow && (stats?.pendingPVCs || 0) > 0 ? 'cursor-pointer hover:bg-secondary/50' : ''} transition-colors`}
                  onClick={() => {
                    if (hasDataToShow && (stats?.pendingPVCs || 0) > 0) {
                      setPVCModalFilter('Pending')
                      setShowPVCModal(true)
                    }
                  }}
                  title={!hasDataToShow ? 'No reachable clusters' : (stats?.pendingPVCs || 0) > 0 ? `${stats?.pendingPVCs} PVC${(stats?.pendingPVCs || 0) !== 1 ? 's' : ''} pending - Click to view list` : 'No pending PVCs'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">Pending</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-400">{formatStatValue(stats?.pendingPVCs || 0, hasDataToShow)}</div>
                  <div className="text-xs text-muted-foreground">PVCs pending</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Cards Section */}
      <div className="mb-6">
        {/* Card section header with toggle and buttons */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowCards(!showCards)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Storage Cards ({cards.length})</span>
            {showCards ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
            >
              <Layout className="w-3.5 h-3.5" />
              Templates
            </button>
            <button
              onClick={() => setShowAddCard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Card
            </button>
          </div>
        </div>

        {/* Cards grid */}
        {showCards && (
          <>
            {cards.length === 0 ? (
              <div className="glass p-8 rounded-lg border-2 border-dashed border-border/50 text-center">
                <div className="flex justify-center mb-4">
                  <HardDrive className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Storage Dashboard</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                  Add cards to monitor PersistentVolumes, StorageClasses, and storage utilization across your clusters.
                </p>
                <button
                  onClick={() => setShowAddCard(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Cards
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {cards.map(card => {
                  const CardComponent = CARD_COMPONENTS[card.card_type]
                  if (!CardComponent) {
                    console.warn(`Unknown card type: ${card.card_type}`)
                    return null
                  }
                  const cardWidth = card.position?.w || 4
                  return (
                    <div
                      key={card.id}
                      style={{ gridColumn: `span ${cardWidth}` }}
                    >
                      <CardWrapper
                        cardId={card.id}
                        cardType={card.card_type}
                        title={card.title || card.card_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        cardWidth={cardWidth}
                        onConfigure={() => handleConfigureCard(card.id)}
                        onRemove={() => handleRemoveCard(card.id)}
                        onWidthChange={(newWidth) => handleWidthChange(card.id, newWidth)}
                      >
                      <CardComponent config={card.config} />
                    </CardWrapper>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={showAddCard}
        onClose={() => setShowAddCard(false)}
        onAddCards={handleAddCards}
        existingCardTypes={cards.map(c => c.card_type)}
      />

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onApplyTemplate={applyTemplate}
      />

      {/* Configure Card Modal */}
      <ConfigureCardModal
        isOpen={!!configuringCard}
        card={configureCard}
        onClose={() => setConfiguringCard(null)}
        onSave={handleSaveCardConfig}
      />

      {/* PVC List Modal */}
      <PVCListModal
        isOpen={showPVCModal}
        onClose={() => setShowPVCModal(false)}
        pvcs={filteredPVCs}
        title={pvcModalFilter === 'all' ? 'All PVCs' : pvcModalFilter === 'Bound' ? 'Bound PVCs' : 'Pending PVCs'}
        statusFilter={pvcModalFilter}
        onSelectPVC={(cluster, namespace, name) => {
          setShowPVCModal(false)
          drillToPVC(cluster, namespace, name)
        }}
      />
    </div>
  )
}
