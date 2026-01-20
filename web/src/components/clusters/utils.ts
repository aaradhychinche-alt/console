import { ClusterInfo } from '../../hooks/useMCP'

// Helper to determine if cluster is unreachable vs just unhealthy
// A reachable cluster always has at least 1 node - 0 nodes means we couldn't connect
export const isClusterUnreachable = (c: ClusterInfo): boolean => {
  if (c.reachable === false) return true
  if (c.errorType && ['timeout', 'network', 'certificate'].includes(c.errorType)) return true
  // nodeCount === 0 means unreachable (health check completed but no nodes)
  // nodeCount === undefined means still checking - treat as loading, not unreachable
  if (c.nodeCount === 0) return true
  return false
}

// Helper to determine if cluster health is still loading
// Returns true for initial load (no data) or during refresh
export const isClusterLoading = (c: ClusterInfo): boolean => {
  // Initial load - no data yet
  if (c.nodeCount === undefined && c.reachable === undefined) return true
  // Manual refresh in progress
  if (c.refreshing === true) return true
  return false
}

// Helper to format labels/annotations for tooltip
export function formatMetadata(labels?: Record<string, string>, annotations?: Record<string, string>): string {
  const parts: string[] = []
  if (labels && Object.keys(labels).length > 0) {
    parts.push('Labels:')
    Object.entries(labels).slice(0, 5).forEach(([k, v]) => {
      parts.push(`  ${k}=${v}`)
    })
    if (Object.keys(labels).length > 5) {
      parts.push(`  ... and ${Object.keys(labels).length - 5} more`)
    }
  }
  if (annotations && Object.keys(annotations).length > 0) {
    if (parts.length > 0) parts.push('')
    parts.push('Annotations:')
    Object.entries(annotations).slice(0, 3).forEach(([k, v]) => {
      const truncatedValue = v.length > 50 ? v.slice(0, 50) + '...' : v
      parts.push(`  ${k}=${truncatedValue}`)
    })
    if (Object.keys(annotations).length > 3) {
      parts.push(`  ... and ${Object.keys(annotations).length - 3} more`)
    }
  }
  return parts.join('\n')
}

export interface ClusterCard {
  id: string
  card_type: string
  config: Record<string, unknown>
  title?: string
}

// Storage key for cluster page cards
const CLUSTERS_CARDS_KEY = 'kubestellar-clusters-cards'

export function loadClusterCards(): ClusterCard[] {
  try {
    const stored = localStorage.getItem(CLUSTERS_CARDS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveClusterCards(cards: ClusterCard[]): void {
  localStorage.setItem(CLUSTERS_CARDS_KEY, JSON.stringify(cards))
}
