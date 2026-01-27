import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Shield, AlertTriangle, CheckCircle, ExternalLink, XCircle, Info, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { BaseModal } from '../../lib/modals'
import { RefreshButton } from '../ui/RefreshIndicator'
import { ClusterFilterDropdown } from '../ui/ClusterFilterDropdown'
import { useClusters } from '../../hooks/useMCP'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import { useChartFilters } from '../../lib/cards'
import { useMissions } from '../../hooks/useMissions'
import { kubectlProxy } from '../../lib/kubectlProxy'

// Violation detail interface
interface Violation {
  name: string
  namespace: string
  kind: string
  policy: string
  message: string
  severity: 'critical' | 'warning' | 'info'
}

// Policy interface for real data
interface Policy {
  name: string
  kind: string // ConstraintTemplate kind
  violations: number
  mode: 'warn' | 'enforce' | 'dryrun' | 'deny'
}

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
  mode?: 'dryrun' | 'warn' | 'enforce' | 'deny'
  modes?: ('warn' | 'enforce' | 'dryrun')[]  // All active modes for multi-badge display
  loading: boolean
  error?: string
  policies?: Policy[]
  violations?: Violation[]
}

async function checkGatekeeperStatus(clusterName: string): Promise<GatekeeperStatus> {
  try {
    console.log('[OPA] Checking gatekeeper on:', clusterName)

    // Step 1: Check if gatekeeper-system namespace exists
    const nsResult = await kubectlProxy.exec(
      ['get', 'namespace', 'gatekeeper-system', '--ignore-not-found', '-o', 'name'],
      { context: clusterName, timeout: 15000 }
    )
    console.log('[OPA] Namespace result for', clusterName, ':', nsResult)

    if (!nsResult.output || !nsResult.output.includes('gatekeeper-system')) {
      console.log('[OPA] Gatekeeper NOT installed on:', clusterName)
      return { cluster: clusterName, installed: false, loading: false }
    }

    // Step 2: Fetch all constraints with violation counts
    const constraintsResult = await kubectlProxy.exec(
      ['get', 'constraints', '-A',
       '-o', 'custom-columns=NAME:.metadata.name,KIND:.kind,ENFORCEMENT:.spec.enforcementAction,VIOLATIONS:.status.totalViolations',
       '--no-headers'],
      { context: clusterName, timeout: 15000 }
    )

    const policies: Policy[] = []
    let totalViolations = 0
    const modes = new Set<string>()

    if (constraintsResult.output) {
      const lines = constraintsResult.output.trim().split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 4) {
          const name = parts[0]
          const kind = parts[1]
          const enforcement = (parts[2] || 'warn').toLowerCase() as Policy['mode']
          const violations = parseInt(parts[3], 10) || 0

          // Normalize deny to enforce for display
          const normalizedMode = enforcement === 'deny' ? 'enforce' : enforcement as Policy['mode']
          policies.push({
            name,
            kind,
            violations,
            mode: normalizedMode
          })
          totalViolations += violations
          modes.add(normalizedMode)
        }
      }
    }

    // Collect all modes for display (will show multiple badges if mixed)
    const activeModes = Array.from(modes) as ('warn' | 'enforce' | 'dryrun')[]
    // For backward compatibility, pick the most restrictive as primary
    let primaryMode: 'warn' | 'enforce' | 'dryrun' | 'deny' = 'warn'
    if (modes.has('enforce')) {
      primaryMode = 'enforce'
    } else if (modes.has('dryrun')) {
      primaryMode = 'dryrun'
    }

    // Step 3: Fetch some sample violations for display
    const violations: Violation[] = []
    if (totalViolations > 0 && policies.length > 0) {
      // Get violations from the first constraint with violations
      const policyWithViolations = policies.find(p => p.violations > 0)
      if (policyWithViolations) {
        const violationsResult = await kubectlProxy.exec(
          ['get', policyWithViolations.kind.toLowerCase(), policyWithViolations.name,
           '-o', 'jsonpath={.status.violations[*]}'],
          { context: clusterName, timeout: 15000 }
        )

        if (violationsResult.output) {
          try {
            // Parse JSON violations array - the output is space-separated JSON objects
            const violationData = JSON.parse(`[${violationsResult.output.replace(/}\s*{/g, '},{')}]`)
            for (const v of violationData.slice(0, 20)) { // Limit to 20 violations
              violations.push({
                name: v.name || 'Unknown',
                namespace: v.namespace || 'default',
                kind: v.kind || 'Resource',
                policy: policyWithViolations.name,
                message: v.message || 'Policy violation',
                severity: policyWithViolations.mode === 'enforce' || policyWithViolations.mode === 'deny' ? 'critical' : 'warning'
              })
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return {
      cluster: clusterName,
      installed: true,
      loading: false,
      policyCount: policies.length,
      violationCount: totalViolations,
      mode: primaryMode,
      modes: activeModes,
      policies,
      violations
    }
  } catch (err) {
    console.error('[OPA] Error checking gatekeeper on', clusterName, err)
    return { cluster: clusterName, installed: false, loading: false, error: 'Connection failed' }
  }
}


// Policy Detail Modal
function PolicyDetailModal({
  isOpen,
  onClose,
  policy,
  violations,
  onAddPolicy
}: {
  isOpen: boolean
  onClose: () => void
  policy: Policy
  violations: Violation[]
  onAddPolicy: () => void
}) {
  // Get violations for this policy
  const policyViolations = violations.filter(v => v.policy === policy.name)

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'enforce':
      case 'deny':
        return 'text-red-400 bg-red-500/20'
      case 'warn': return 'text-amber-400 bg-amber-500/20'
      default: return 'text-blue-400 bg-blue-500/20'
    }
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="md">
      <BaseModal.Header
        title={policy.name}
        description={policy.kind}
        icon={Shield}
        onClose={onClose}
        showBack={false}
      />

      <BaseModal.Content className="max-h-[50vh]">
        {/* Policy Info */}
        <div className="mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Enforcement Mode</p>
              <span className={`px-2 py-1 rounded text-sm font-medium ${getModeColor(policy.mode)}`}>
                {policy.mode}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Violations</p>
              <p className={`text-2xl font-bold ${policy.violations > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {policy.violations}
              </p>
            </div>
          </div>
        </div>

        {/* Violations List */}
        {policyViolations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p>No violations for this policy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {policyViolations.map((violation, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{violation.name}</span>
                  <span className="text-xs text-muted-foreground">{violation.kind}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{violation.message}</p>
                <span className="text-xs text-muted-foreground">Namespace: <span className="text-foreground">{violation.namespace}</span></span>
              </div>
            ))}
          </div>
        )}
      </BaseModal.Content>

      <BaseModal.Footer>
        <a
          href={`https://open-policy-agent.github.io/gatekeeper-library/website/${policy.kind.toLowerCase()}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          Policy Documentation
          <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onClose()
              onAddPolicy()
            }}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            Create Similar Policy
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </BaseModal.Footer>
    </BaseModal>
  )
}

// Violations Modal Component
function ViolationsModal({
  isOpen,
  onClose,
  clusterName,
  violations,
  onAddPolicy
}: {
  isOpen: boolean
  onClose: () => void
  clusterName: string
  violations: Violation[]
  onAddPolicy: () => void
}) {
  const severityCounts = {
    critical: violations.filter(v => v.severity === 'critical').length,
    warning: violations.filter(v => v.severity === 'warning').length,
    info: violations.filter(v => v.severity === 'info').length,
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20'
      case 'warning': return 'text-amber-400 bg-amber-500/20'
      default: return 'text-blue-400 bg-blue-500/20'
    }
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="lg">
      <BaseModal.Header
        title="OPA Gatekeeper Violations"
        description={clusterName}
        icon={Shield}
        onClose={onClose}
        showBack={false}
      />

      <BaseModal.Content className="max-h-[50vh]">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-border">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-2xl font-bold text-red-400">{severityCounts.critical}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold text-amber-400">{severityCounts.warning}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-2xl font-bold text-blue-400">{severityCounts.info}</p>
            <p className="text-xs text-muted-foreground">Info</p>
          </div>
        </div>

        {/* Violations List - sorted by severity */}
        <div className="space-y-2">
          {[...violations]
            .sort((a, b) => {
              const severityOrder = { critical: 0, warning: 1, info: 2 }
              return severityOrder[a.severity] - severityOrder[b.severity]
            })
            .map((violation, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                    {violation.severity}
                  </span>
                  <span className="text-sm font-medium text-foreground">{violation.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{violation.kind}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{violation.message}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Namespace: <span className="text-foreground">{violation.namespace}</span></span>
                <span>Policy: <span className="text-orange-400">{violation.policy}</span></span>
              </div>
            </div>
          ))}
        </div>
      </BaseModal.Content>

      <BaseModal.Footer>
        <a
          href="https://open-policy-agent.github.io/gatekeeper/website/docs/violations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          Learn about violations
          <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onClose()
              onAddPolicy()
            }}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            Create Policy with Klaude
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </BaseModal.Footer>
    </BaseModal>
  )
}

export function OPAPolicies({ config: _config }: OPAPoliciesProps) {
  const { deduplicatedClusters: clusters } = useClusters()
  const { selectedClusters, isAllClustersSelected } = useGlobalFilters()
  const { startMission } = useMissions()

  // Fetch clusters directly from agent as fallback
  const [agentClusters, setAgentClusters] = useState<{ name: string; healthy?: boolean }[]>([])
  useEffect(() => {
    fetch('http://127.0.0.1:8585/clusters')
      .then(res => res.json())
      .then(data => {
        if (data.clusters) {
          console.log('[OPA] Fetched clusters from agent:', data.clusters.map((c: { name: string }) => c.name))
          setAgentClusters(data.clusters.map((c: { name: string }) => ({ name: c.name, healthy: true })))
        }
      })
      .catch(err => console.error('[OPA] Failed to fetch clusters:', err))
  }, [])

  // Use agent clusters if shared state is empty
  const effectiveClusters = clusters.length > 0 ? clusters : agentClusters

  // Local cluster filter
  const {
    localClusterFilter,
    toggleClusterFilter,
    clearClusterFilter,
    availableClusters,
    showClusterFilter,
    setShowClusterFilter,
    clusterFilterRef,
  } = useChartFilters({
    storageKey: 'opa-policies',
  })
  const [statuses, setStatuses] = useState<Record<string, GatekeeperStatus>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [showViolationsModal, setShowViolationsModal] = useState(false)
  const [selectedClusterForViolations, setSelectedClusterForViolations] = useState<string>('')
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [localSearch, setLocalSearch] = useState('')

  // Use ref to avoid recreating checkAllClusters on every status change
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses

  // Filter clusters
  // IMPORTANT: Don't filter by healthy status - the agent can reach clusters that browser health checks can't
  // The OPA card uses kubectl via the agent, not browser-based API calls
  const filteredClusters = useMemo(() => {
    // Start with effective clusters (agent clusters if shared state is empty)
    let result = effectiveClusters

    // Apply global cluster filter (but NOT health filter - agent can reach unreachable clusters)
    if (!isAllClustersSelected) {
      result = result.filter(c => selectedClusters.includes(c.name))
    }

    // Apply local cluster filter
    if (localClusterFilter.length > 0) {
      result = result.filter(c => localClusterFilter.includes(c.name))
    }
    // Apply local search
    if (localSearch.trim()) {
      const query = localSearch.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(query))
    }
    return result
  }, [effectiveClusters, isAllClustersSelected, selectedClusters, localClusterFilter, localSearch])

  // Check Gatekeeper on filtered clusters - sequentially to avoid overwhelming kubectlProxy queue
  const checkAllClusters = useCallback(async () => {
    console.log('[OPA] checkAllClusters called, filteredClusters:', filteredClusters.map(c => c.name))
    if (filteredClusters.length === 0) return

    setIsRefreshing(true)

    try {
      // Start with existing statuses (stale-while-revalidate pattern)
      const newStatuses: Record<string, GatekeeperStatus> = { ...statusesRef.current }

      // Check clusters sequentially to avoid overwhelming the kubectlProxy queue
      for (const cluster of filteredClusters) {
        try {
          const status = await checkGatekeeperStatus(cluster.name)
          newStatuses[cluster.name] = status
          // Update UI progressively as each cluster completes
          setStatuses({ ...newStatuses })
        } catch (err) {
          console.error('[OPA] Error checking', cluster.name, err)
          newStatuses[cluster.name] = { cluster: cluster.name, installed: false, loading: false, error: String(err) }
          setStatuses({ ...newStatuses })
        }
      }
    } finally {
      setIsRefreshing(false)
      setHasChecked(true)
    }
  }, [filteredClusters])

  useEffect(() => {
    console.log('[OPA] Effect: hasChecked=', hasChecked, 'filteredClusters=', filteredClusters.length)
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

  const handleShowViolations = (clusterName: string) => {
    setSelectedClusterForViolations(clusterName)
    setShowViolationsModal(true)
  }

  const handleAddPolicy = (basedOnPolicy?: string) => {
    // Get the first installed cluster, or use a default
    const installedCluster = Object.entries(statuses).find(([_, s]) => s.installed)?.[0] || 'default'

    startMission({
      title: 'Create OPA Gatekeeper Policy',
      description: basedOnPolicy
        ? `Create a policy similar to ${basedOnPolicy}`
        : 'Create a new OPA Gatekeeper policy',
      type: 'deploy',
      cluster: installedCluster,
      initialPrompt: basedOnPolicy
        ? `I want to create a new OPA Gatekeeper policy similar to "${basedOnPolicy}".

Please help me:
1. Explain what the ${basedOnPolicy} policy does
2. Ask me what modifications I want to make
3. Generate a ConstraintTemplate and Constraint for my requirements
4. Help me apply it to the cluster
5. Test that the policy is working

Let's start by discussing what kind of policy I need.`
        : `I want to create a new OPA Gatekeeper policy for my Kubernetes cluster.

Please help me:
1. Ask me what kind of policy I want to enforce (e.g., require labels, restrict images, enforce resource limits)
2. Generate the appropriate ConstraintTemplate and Constraint
3. Help me apply it to the cluster
4. Test that the policy is working

Let's start by discussing what kind of policy I need.`,
      context: { basedOnPolicy },
    })
  }

  return (
    <div className="h-full flex flex-col min-h-card">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        {installedCount > 0 ? (
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">
            {installedCount} cluster{installedCount !== 1 ? 's' : ''}
          </span>
        ) : <div />}
        <div className="flex items-center gap-1">
          <ClusterFilterDropdown
            localClusterFilter={localClusterFilter}
            availableClusters={effectiveClusters}
            showClusterFilter={showClusterFilter}
            setShowClusterFilter={setShowClusterFilter}
            toggleClusterFilter={toggleClusterFilter}
            clearClusterFilter={clearClusterFilter}
            clusterFilterRef={clusterFilterRef}
          />

          <a
            href="https://open-policy-agent.github.io/gatekeeper/website/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-purple-400"
            title="OPA Gatekeeper Documentation"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={checkAllClusters}
            size="sm"
          />
        </div>
      </div>

      {/* Local Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search clusters..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50"
        />
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

      {/* Cluster list - p-1 -m-1 gives room for focus rings without clipping */}
      <div className="flex-1 overflow-y-auto space-y-2 p-1 -m-1">
        {filteredClusters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No clusters available
          </div>
        ) : (
          filteredClusters.map(cluster => {
            const status = statuses[cluster.name]
            const isLoading = !hasChecked || status?.loading

            return (
              <button
                key={cluster.name}
                onClick={() => status?.installed && handleShowViolations(cluster.name)}
                disabled={!status?.installed || isLoading}
                className={`w-full text-left p-2.5 rounded-lg bg-secondary/30 transition-colors ${
                  status?.installed && !isLoading
                    ? 'hover:bg-secondary/50 cursor-pointer group'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium text-foreground ${status?.installed ? 'group-hover:text-purple-400' : ''}`}>
                    {cluster.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {isLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    ) : status?.installed ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </>
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
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
                      {(status.modes && status.modes.length > 1 ? status.modes : [status.mode]).map((mode, idx) => (
                        <span key={idx} className={`px-1.5 py-0.5 rounded text-[10px] ${
                          mode === 'enforce' ? 'bg-red-500/20 text-red-400' :
                          mode === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {mode}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Not installed</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInstallOPA(cluster.name)
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                      Install with Klaude →
                    </span>
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Add Policy Button */}
      {installedCount > 0 && (
        <button
          onClick={() => handleAddPolicy()}
          className="w-full mt-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2 group"
        >
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400 group-hover:text-purple-300">Create Policy with Klaude</span>
        </button>
      )}

      {/* Active policies preview - show real policies from first cluster with policies */}
      {installedCount > 0 && (() => {
        const clusterWithPolicies = Object.values(statuses).find(s => s.installed && s.policies && s.policies.length > 0)
        const policies = clusterWithPolicies?.policies || []
        if (policies.length === 0) return null

        return (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-medium mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Active Policies
            </p>
            <div className="space-y-1">
              {policies.slice(0, 4).map(policy => (
                <button
                  key={policy.name}
                  onClick={() => {
                    setSelectedPolicy(policy)
                    setShowPolicyModal(true)
                  }}
                  className="w-full flex items-center justify-between text-xs p-1.5 -mx-1.5 rounded hover:bg-secondary/50 transition-colors group"
                >
                  <span className="text-foreground truncate group-hover:text-purple-400">{policy.name}</span>
                  <div className="flex items-center gap-2">
                    {policy.violations > 0 && (
                      <span className="text-amber-400">{policy.violations.toLocaleString()}</span>
                    )}
                    <span className={`px-1 py-0.5 rounded text-[9px] ${
                      policy.mode === 'enforce' || policy.mode === 'deny' ? 'bg-red-500/20 text-red-400' :
                      policy.mode === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {policy.mode}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

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

      {/* Violations Modal */}
      <ViolationsModal
        isOpen={showViolationsModal}
        onClose={() => setShowViolationsModal(false)}
        clusterName={selectedClusterForViolations}
        violations={statuses[selectedClusterForViolations]?.violations || []}
        onAddPolicy={() => handleAddPolicy()}
      />

      {/* Policy Detail Modal */}
      {selectedPolicy && (
        <PolicyDetailModal
          isOpen={showPolicyModal}
          onClose={() => {
            setShowPolicyModal(false)
            setSelectedPolicy(null)
          }}
          policy={selectedPolicy}
          violations={Object.values(statuses).flatMap(s => s.violations || [])}
          onAddPolicy={() => handleAddPolicy(selectedPolicy.name)}
        />
      )}
    </div>
  )
}
