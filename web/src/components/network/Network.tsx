import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Globe, Network as NetworkIcon, Shield, Workflow, Plus, Layout, LayoutGrid, ChevronDown, ChevronRight, RefreshCw, Activity, Hourglass } from 'lucide-react'
import { useServices } from '../../hooks/useMCP'
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

interface NetworkCard {
  id: string
  card_type: string
  config: Record<string, unknown>
  title?: string
  position?: { w: number; h: number }
}

const NETWORK_CARDS_KEY = 'kubestellar-network-cards'

function loadNetworkCards(): NetworkCard[] {
  try {
    const stored = localStorage.getItem(NETWORK_CARDS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveNetworkCards(cards: NetworkCard[]) {
  localStorage.setItem(NETWORK_CARDS_KEY, JSON.stringify(cards))
}

export function Network() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { services, isLoading: servicesLoading, isRefreshing: servicesRefreshing, lastUpdated, refetch } = useServices()
  const {
    selectedClusters: globalSelectedClusters,
    isAllClustersSelected,
  } = useGlobalFilters()
  const { drillToService } = useDrillDownActions()

  // Card state
  const [cards, setCards] = useState<NetworkCard[]>(() => loadNetworkCards())
  const [showStats, setShowStats] = useState(true)
  const { showCards, setShowCards, expandCards } = useShowCards('kubestellar-network')
  const [showAddCard, setShowAddCard] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [configuringCard, setConfiguringCard] = useState<NetworkCard | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Show loading spinner when fetching (initial or refresh)
  const isFetching = servicesLoading || servicesRefreshing
  // Only show skeletons when we have no data yet
  const showSkeletons = services.length === 0 && servicesLoading

  // Save cards to localStorage when they change
  useEffect(() => {
    saveNetworkCards(cards)
  }, [cards])

  // Handle addCard URL param - open modal and clear param
  useEffect(() => {
    if (searchParams.get('addCard') === 'true') {
      setShowAddCard(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
    const cardsToAdd: NetworkCard[] = newCards.map(card => ({
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      card_type: card.type,
      config: card.config,
      title: card.title,
    }))
    setCards(prev => [...prev, ...cardsToAdd])
    expandCards()
    setShowAddCard(false)
  }, [])

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
    const newCards: NetworkCard[] = template.cards.map(card => ({
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      card_type: card.card_type,
      config: card.config || {},
      title: card.title,
    }))
    setCards(newCards)
    expandCards()
    setShowTemplates(false)
  }, [])

  // Filter services based on global cluster selection
  const filteredServices = services.filter(s =>
    isAllClustersSelected || (s.cluster && globalSelectedClusters.includes(s.cluster))
  )

  // Calculate service stats
  const loadBalancers = filteredServices.filter(s => s.type === 'LoadBalancer').length
  const nodePortServices = filteredServices.filter(s => s.type === 'NodePort').length
  const clusterIPServices = filteredServices.filter(s => s.type === 'ClusterIP').length

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
                <Globe className="w-6 h-6 text-purple-400" />
                Network
              </h1>
              <p className="text-muted-foreground">Monitor network resources across clusters</p>
            </div>
            {servicesRefreshing && (
              <span className="flex items-center gap-1 text-xs text-amber-400 animate-pulse" title="Updating...">
                <Hourglass className="w-3 h-3" />
                <span>Updating</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="network-auto-refresh" className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground" title="Auto-refresh every 30s">
              <input
                type="checkbox"
                id="network-auto-refresh"
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
              // Real data
              <>
                <div
                  className={`glass p-4 rounded-lg ${filteredServices.length > 0 ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'} transition-colors`}
                  onClick={() => {
                    if (filteredServices.length > 0 && filteredServices[0]) {
                      drillToService(filteredServices[0].cluster || 'default', filteredServices[0].namespace || 'default', filteredServices[0].name)
                    }
                  }}
                  title={filteredServices.length > 0 ? `${filteredServices.length} total services - Click to view details` : 'No services found'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Workflow className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-muted-foreground">Services</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">{filteredServices.length}</div>
                  <div className="text-xs text-muted-foreground">total services</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${loadBalancers > 0 ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'} transition-colors`}
                  onClick={() => {
                    const svc = filteredServices.find(s => s.type === 'LoadBalancer')
                    if (svc) drillToService(svc.cluster || 'default', svc.namespace || 'default', svc.name)
                  }}
                  title={loadBalancers > 0 ? `${loadBalancers} LoadBalancer service${loadBalancers !== 1 ? 's' : ''} - Click to view details` : 'No LoadBalancer services'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-muted-foreground">LoadBalancers</span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">{loadBalancers}</div>
                  <div className="text-xs text-muted-foreground">external access</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${nodePortServices > 0 ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'} transition-colors`}
                  onClick={() => {
                    const svc = filteredServices.find(s => s.type === 'NodePort')
                    if (svc) drillToService(svc.cluster || 'default', svc.namespace || 'default', svc.name)
                  }}
                  title={nodePortServices > 0 ? `${nodePortServices} NodePort service${nodePortServices !== 1 ? 's' : ''} - Click to view details` : 'No NodePort services'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <NetworkIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">NodePort</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-400">{nodePortServices}</div>
                  <div className="text-xs text-muted-foreground">node-level access</div>
                </div>
                <div
                  className={`glass p-4 rounded-lg ${clusterIPServices > 0 ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'} transition-colors`}
                  onClick={() => {
                    const svc = filteredServices.find(s => s.type === 'ClusterIP')
                    if (svc) drillToService(svc.cluster || 'default', svc.namespace || 'default', svc.name)
                  }}
                  title={clusterIPServices > 0 ? `${clusterIPServices} ClusterIP service${clusterIPServices !== 1 ? 's' : ''} - Click to view details` : 'No ClusterIP services'}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-muted-foreground">ClusterIP</span>
                  </div>
                  <div className="text-3xl font-bold text-purple-400">{clusterIPServices}</div>
                  <div className="text-xs text-muted-foreground">internal only</div>
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
            <span>Network Cards ({cards.length})</span>
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
                  <Globe className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Network Dashboard</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                  Add cards to monitor Ingresses, NetworkPolicies, and service mesh configurations across your clusters.
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
    </div>
  )
}
