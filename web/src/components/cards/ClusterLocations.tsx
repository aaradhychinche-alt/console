import { useMemo } from 'react'
import { MapPin, Globe, Server, Cloud } from 'lucide-react'
import { useClusters, type ClusterInfo } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useDrillDownActions } from '../../hooks/useDrillDown'
import { Skeleton } from '../ui/Skeleton'
import { RefreshButton } from '../ui/RefreshIndicator'
import { detectCloudProvider, CloudProviderIcon, type CloudProvider } from '../ui/CloudProviderIcon'
import { StatusIndicator } from '../charts/StatusIndicator'

interface ClusterLocationsProps {
  config?: Record<string, unknown>
}

// Common region display names
const REGION_DISPLAY_NAMES: Record<string, string> = {
  // AWS regions
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'EU West (Ireland)',
  'eu-west-2': 'EU West (London)',
  'eu-west-3': 'EU West (Paris)',
  'eu-central-1': 'EU Central (Frankfurt)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'sa-east-1': 'South America (São Paulo)',
  'ca-central-1': 'Canada (Central)',
  // Azure regions
  'westeurope': 'West Europe',
  'eastus': 'East US',
  'eastus2': 'East US 2',
  'westus': 'West US',
  'westus2': 'West US 2',
  'northeurope': 'North Europe',
  'southeastasia': 'Southeast Asia',
  'australiaeast': 'Australia East',
  // GCP regions
  'us-central1': 'US Central (Iowa)',
  'us-east1': 'US East (S. Carolina)',
  'us-west1': 'US West (Oregon)',
  'europe-west1': 'Europe West (Belgium)',
  'asia-east1': 'Asia East (Taiwan)',
  // OCI regions
  'us-phoenix-1': 'US West (Phoenix)',
  'us-ashburn-1': 'US East (Ashburn)',
  'eu-frankfurt-1': 'EU (Frankfurt)',
  // DigitalOcean
  'nyc1': 'New York 1',
  'nyc2': 'New York 2',
  'nyc3': 'New York 3',
  'sfo1': 'San Francisco 1',
  'sfo2': 'San Francisco 2',
  'sfo3': 'San Francisco 3',
  'ams3': 'Amsterdam 3',
  'sgp1': 'Singapore 1',
  'lon1': 'London 1',
  'fra1': 'Frankfurt 1',
  'tor1': 'Toronto 1',
  'blr1': 'Bangalore 1',
  // Local
  'local': 'Local',
}

interface RegionInfo {
  region: string
  displayName: string
  provider: CloudProvider
  clusters: ClusterInfo[]
}

// Extract region from cluster info
function extractRegion(cluster: ClusterInfo): string | null {
  const name = cluster.name.toLowerCase()
  const serverUrl = cluster.server?.toLowerCase() || ''

  // AWS EKS - extract from URL or name
  const eksUrlMatch = serverUrl.match(/\.([a-z]{2}-[a-z]+-\d)\.eks\.amazonaws\.com/)
  if (eksUrlMatch) return eksUrlMatch[1]
  const eksNameMatch = name.match(/([a-z]{2}-[a-z]+-\d)/)
  if (eksNameMatch && (name.includes('eks') || name.includes('aws'))) return eksNameMatch[1]

  // Azure AKS - extract from URL
  const aksUrlMatch = serverUrl.match(/\.hcp\.([a-z]+)\.azmk8s\.io/)
  if (aksUrlMatch) return aksUrlMatch[1]
  const aksNameMatch = name.match(/(westeurope|eastus|eastus2|westus|westus2|northeurope|southeastasia|australiaeast)/i)
  if (aksNameMatch) return aksNameMatch[1].toLowerCase()

  // OCI - extract from URL or name
  const ociUrlMatch = serverUrl.match(/\.([a-z]+-[a-z]+-\d)\.clusters\.oci/)
  if (ociUrlMatch) return ociUrlMatch[1]
  const ociNameMatch = name.match(/(phoenix|ashburn|frankfurt)/)
  if (ociNameMatch) return `us-${ociNameMatch[1]}-1`

  // GCP GKE - extract from name patterns
  const gkeNameMatch = name.match(/(us-central1|us-east1|us-west1|europe-west1|asia-east1)/i)
  if (gkeNameMatch) return gkeNameMatch[1].toLowerCase()

  // DigitalOcean - extract region code
  const doMatch = name.match(/(nyc[123]|sfo[123]|ams3|sgp1|lon1|fra1|tor1|blr1)/i)
  if (doMatch) return doMatch[1].toLowerCase()

  // Check for common location keywords
  if (name.includes('shanghai')) return 'cn-shanghai'
  if (name.includes('beijing')) return 'cn-beijing'
  if (name.includes('london') || name.includes('lon')) return 'lon1'
  if (name.includes('frankfurt') || name.includes('fra')) return 'eu-central-1'
  if (name.includes('tokyo')) return 'ap-northeast-1'
  if (name.includes('singapore') || name.includes('sgp')) return 'ap-southeast-1'
  if (name.includes('sydney')) return 'ap-southeast-2'

  // Local clusters
  if (name.includes('kind') || name.includes('minikube') || name.includes('k3d') || name.includes('docker-desktop')) {
    return 'local'
  }

  return null
}

// Get region display name
function getRegionDisplayName(region: string): string {
  return REGION_DISPLAY_NAMES[region.toLowerCase()] || region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function ClusterLocations({ config: _config }: ClusterLocationsProps) {
  const { clusters: allClusters, isLoading, isRefreshing, refetch, isFailed, consecutiveFailures, lastRefresh } = useClusters()
  const { drillToCluster } = useDrillDownActions()
  const {
    selectedClusters: globalSelectedClusters,
    isAllClustersSelected,
    customFilter,
  } = useGlobalFilters()

  // Apply global filters
  const clusters = useMemo(() => {
    let result = allClusters.filter(c => c.reachable !== false)

    if (!isAllClustersSelected) {
      result = result.filter(c => globalSelectedClusters.includes(c.name))
    }

    if (customFilter.trim()) {
      const query = customFilter.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.context?.toLowerCase().includes(query)
      )
    }

    return result
  }, [allClusters, globalSelectedClusters, isAllClustersSelected, customFilter])

  // Group clusters by region
  const regionGroups = useMemo(() => {
    const groups = new Map<string, RegionInfo>()

    for (const cluster of clusters) {
      const region = extractRegion(cluster) || 'unknown'
      const provider = detectCloudProvider(cluster.name, cluster.server, cluster.namespaces)

      if (!groups.has(region)) {
        groups.set(region, {
          region,
          displayName: getRegionDisplayName(region),
          provider,
          clusters: [],
        })
      }

      groups.get(region)!.clusters.push(cluster)
    }

    // Sort by cluster count descending
    return Array.from(groups.values()).sort((a, b) => b.clusters.length - a.clusters.length)
  }, [clusters])

  // Calculate stats
  const stats = useMemo(() => {
    const healthyClusters = clusters.filter(c => c.healthy).length
    const uniqueRegions = regionGroups.length
    const providers = new Set(regionGroups.map(r => r.provider))
    return { healthyClusters, totalClusters: clusters.length, uniqueRegions, providerCount: providers.size }
  }, [clusters, regionGroups])

  if (isLoading) {
    return (
      <div className="h-full flex flex-col min-h-card">
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="text" width={140} height={20} />
          <Skeleton variant="rounded" width={80} height={28} />
        </div>
        <div className="space-y-2">
          <Skeleton variant="rounded" height={60} />
          <Skeleton variant="rounded" height={60} />
          <Skeleton variant="rounded" height={60} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-card content-loaded">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-foreground">Cluster Locations</span>
        </div>
        <RefreshButton
          isRefreshing={isRefreshing}
          isFailed={isFailed}
          consecutiveFailures={consecutiveFailures}
          lastRefresh={lastRefresh}
          onRefresh={refetch}
          size="sm"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Server className="w-3 h-3" />
          <span>{stats.totalClusters} clusters</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{stats.uniqueRegions} regions</span>
        </div>
        <div className="flex items-center gap-1">
          <Cloud className="w-3 h-3" />
          <span>{stats.providerCount} providers</span>
        </div>
      </div>

      {/* Region Groups */}
      <div className="flex-1 space-y-3 overflow-y-auto min-h-0">
        {regionGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-8">
            <div className="text-center">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No clusters found</p>
            </div>
          </div>
        ) : (
          regionGroups.map(group => (
            <div key={group.region} className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              {/* Region Header */}
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-foreground">{group.displayName}</span>
                <span className="text-xs text-muted-foreground">({group.region})</span>
                <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
                  {group.clusters.length} cluster{group.clusters.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Clusters in Region */}
              <div className="flex flex-wrap gap-2">
                {group.clusters.map(cluster => {
                  const provider = detectCloudProvider(cluster.name, cluster.server, cluster.namespaces)
                  return (
                    <button
                      key={cluster.name}
                      onClick={() => drillToCluster(cluster.name)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 transition-colors group"
                    >
                      <CloudProviderIcon provider={provider} size={14} />
                      <span className="text-xs text-foreground group-hover:text-purple-400">{cluster.name}</span>
                      <StatusIndicator status={cluster.healthy ? 'healthy' : 'error'} size="sm" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Provider Legend */}
      {regionGroups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {Array.from(new Set(regionGroups.flatMap(r => r.clusters.map(c => detectCloudProvider(c.name, c.server, c.namespaces))))).map(provider => (
              <div key={provider} className="flex items-center gap-1.5">
                <CloudProviderIcon provider={provider} size={14} />
                <span className="capitalize">{provider}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
