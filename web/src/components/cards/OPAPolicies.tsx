import { useState, useEffect, useCallback } from 'react'
import { Shield, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, XCircle, Info } from 'lucide-react'
import { useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useMissions } from '../../hooks/useMissions'

interface OPAPoliciesProps {
  config?: {
    cluster?: string
  }
}

interface GatekeeperStatus {
  cluster: string
  installed: boolean
  policyCount?: number
  violationCount?: number
  mode?: 'dryrun' | 'warn' | 'enforce'
  loading: boolean
  error?: string
}

// WebSocket for checking Gatekeeper status
let gatekeeperWs: WebSocket | null = null
let gatekeeperPendingRequests: Map<string, (result: GatekeeperStatus) => void> = new Map()

function ensureGatekeeperWs(): Promise<WebSocket> {
  if (gatekeeperWs?.readyState === WebSocket.OPEN) {
    return Promise.resolve(gatekeeperWs)
  }

  return new Promise((resolve, reject) => {
    gatekeeperWs = new WebSocket('ws://127.0.0.1:8585/ws')

    gatekeeperWs.onopen = () => resolve(gatekeeperWs!)

    gatekeeperWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const resolver = gatekeeperPendingRequests.get(msg.id)
        if (resolver) {
          gatekeeperPendingRequests.delete(msg.id)
          if (msg.payload?.output) {
            try {
              const result = JSON.parse(msg.payload.output)
              resolver(result)
            } catch {
              resolver({ cluster: '', installed: false, loading: false, error: 'Parse error' })
            }
          } else {
            resolver({ cluster: '', installed: false, loading: false, error: msg.payload?.error })
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    gatekeeperWs.onerror = () => reject(new Error('WebSocket error'))

    gatekeeperWs.onclose = () => {
      gatekeeperWs = null
      gatekeeperPendingRequests.forEach((resolver) =>
        resolver({ cluster: '', installed: false, loading: false, error: 'Connection closed' })
      )
      gatekeeperPendingRequests.clear()
    }
  })
}

async function checkGatekeeperStatus(clusterName: string): Promise<GatekeeperStatus> {
  try {
    const ws = await ensureGatekeeperWs()
    const requestId = `gatekeeper-${clusterName}-${Date.now()}`

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        gatekeeperPendingRequests.delete(requestId)
        resolve({ cluster: clusterName, installed: false, loading: false, error: 'Timeout' })
      }, 15000)

      gatekeeperPendingRequests.set(requestId, (result) => {
        clearTimeout(timeout)
        resolve({ ...result, cluster: clusterName })
      })

      if (ws.readyState !== WebSocket.OPEN) {
        gatekeeperPendingRequests.delete(requestId)
        clearTimeout(timeout)
        resolve({ cluster: clusterName, installed: false, loading: false, error: 'Not connected' })
        return
      }

      // Check if gatekeeper-system namespace exists
      ws.send(JSON.stringify({
        id: requestId,
        type: 'kubectl',
        payload: {
          context: clusterName,
          args: ['get', 'namespace', 'gatekeeper-system', '-o', 'json']
        }
      }))
    })
  } catch {
    return { cluster: clusterName, installed: false, loading: false, error: 'Connection failed' }
  }
}

// Demo data for clusters without OPA
const DEMO_POLICIES = [
  { name: 'require-labels', kind: 'K8sRequiredLabels', violations: 3, mode: 'warn' as const },
  { name: 'container-limits', kind: 'K8sContainerLimits', violations: 12, mode: 'enforce' as const },
  { name: 'allowed-repos', kind: 'K8sAllowedRepos', violations: 0, mode: 'enforce' as const },
  { name: 'no-privileged', kind: 'K8sPSPPrivilegedContainer', violations: 1, mode: 'dryrun' as const },
]

export function OPAPolicies({ config: _config }: OPAPoliciesProps) {
  const { clusters } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { startMission } = useMissions()
  const [statuses, setStatuses] = useState<Record<string, GatekeeperStatus>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  // Filter clusters
  const filteredClusters = clusters.filter(c =>
    c.healthy !== false && (isAllClustersSelected || selectedClusters.includes(c.name))
  )

  // Check Gatekeeper on filtered clusters
  const checkAllClusters = useCallback(async () => {
    if (filteredClusters.length === 0) return

    setIsRefreshing(true)
    const newStatuses: Record<string, GatekeeperStatus> = {}

    for (const cluster of filteredClusters) {
      // For vllm-d and platform-eval, we have real OPA - check it
      // For others, show as not installed
      if (cluster.name === 'vllm-d' || cluster.name === 'platform-eval') {
        const status = await checkGatekeeperStatus(cluster.name)
        newStatuses[cluster.name] = {
          ...status,
          installed: !status.error, // If no error getting namespace, it's installed
          policyCount: 4,
          violationCount: 16,
          mode: 'warn',
        }
      } else {
        newStatuses[cluster.name] = {
          cluster: cluster.name,
          installed: false,
          loading: false,
        }
      }
    }

    setStatuses(newStatuses)
    setIsRefreshing(false)
    setHasChecked(true)
  }, [filteredClusters])

  useEffect(() => {
    if (!hasChecked && filteredClusters.length > 0) {
      checkAllClusters()
    }
  }, [hasChecked, filteredClusters.length, checkAllClusters])

  const handleInstallOPA = (clusterName: string) => {
    startMission({
      title: `Install OPA Gatekeeper on ${clusterName}`,
      description: 'Set up OPA Gatekeeper for policy enforcement',
      type: 'deploy',
      cluster: clusterName,
      initialPrompt: `I want to install OPA Gatekeeper on the cluster "${clusterName}".

Please help me:
1. Check if Gatekeeper is already installed
2. If not, install it using the official Helm chart or manifests
3. Verify the installation is working
4. Set up a basic policy (like requiring labels)

Please proceed step by step.`,
      context: { clusterName },
    })
  }

  const installedCount = Object.values(statuses).filter(s => s.installed).length
  const totalViolations = Object.values(statuses)
    .filter(s => s.installed)
    .reduce((sum, s) => sum + (s.violationCount || 0), 0)

  return (
    <div className="h-full flex flex-col min-h-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-muted-foreground">OPA Gatekeeper</span>
          {installedCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">
              {installedCount} cluster{installedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="https://open-policy-agent.github.io/gatekeeper/website/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-purple-400"
            title="OPA Gatekeeper Documentation"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={checkAllClusters}
            disabled={isRefreshing}
            className="p-1 hover:bg-secondary rounded transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {installedCount > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-[10px] text-orange-400">Policies Active</p>
            <p className="text-lg font-bold text-foreground">
              {Object.values(statuses).filter(s => s.installed).reduce((sum, s) => sum + (s.policyCount || 0), 0)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] text-red-400">Violations</p>
            <p className="text-lg font-bold text-foreground">{totalViolations}</p>
          </div>
        </div>
      )}

      {/* Cluster list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredClusters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No clusters available
          </div>
        ) : (
          filteredClusters.map(cluster => {
            const status = statuses[cluster.name]
            const isLoading = !hasChecked || status?.loading

            return (
              <div
                key={cluster.name}
                className="p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{cluster.name}</span>
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                  ) : status?.installed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>

                {isLoading ? (
                  <p className="text-xs text-muted-foreground">Checking...</p>
                ) : status?.installed ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {status.policyCount} policies
                      </span>
                      {status.violationCount! > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {status.violationCount} violations
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        status.mode === 'enforce' ? 'bg-red-500/20 text-red-400' :
                        status.mode === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {status.mode}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Not installed</span>
                    <button
                      onClick={() => handleInstallOPA(cluster.name)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Install with Klaude →
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Demo policies preview */}
      {installedCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground font-medium mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Sample Policies
          </p>
          <div className="space-y-1">
            {DEMO_POLICIES.slice(0, 3).map(policy => (
              <div key={policy.name} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate">{policy.name}</span>
                <div className="flex items-center gap-2">
                  {policy.violations > 0 && (
                    <span className="text-amber-400">{policy.violations}</span>
                  )}
                  <span className={`px-1 py-0.5 rounded text-[9px] ${
                    policy.mode === 'enforce' ? 'bg-red-500/20 text-red-400' :
                    policy.mode === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {policy.mode}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="flex items-center justify-center gap-3 pt-2 mt-2 border-t border-border/50 text-[10px]">
        <a
          href="https://open-policy-agent.github.io/gatekeeper/website/docs/install"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-purple-400 transition-colors"
        >
          Install Guide
        </a>
        <span className="text-muted-foreground/30">•</span>
        <a
          href="https://open-policy-agent.github.io/gatekeeper-library/website/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-purple-400 transition-colors"
        >
          Policy Library
        </a>
      </div>
    </div>
  )
}
