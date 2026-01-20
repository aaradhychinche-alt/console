import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGPUNodes, usePodIssues, useClusters } from './useMCP'
import { useMissions } from './useMissions'
import type {
  Alert,
  AlertRule,
  AlertStats,
  SlackWebhook,
} from '../types/alerts'
import { PRESET_ALERT_RULES } from '../types/alerts'

// Generate unique ID
function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Local storage keys
const ALERT_RULES_KEY = 'klaude_alert_rules'
const ALERTS_KEY = 'klaude_alerts'
const SLACK_WEBHOOKS_KEY = 'klaude_slack_webhooks'

// Load from localStorage
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage:`, e)
  }
  return defaultValue
}

// Save to localStorage
function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e)
  }
}

// Hook for managing alert rules
export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>(() => {
    const stored = loadFromStorage<AlertRule[]>(ALERT_RULES_KEY, [])
    // Initialize with preset rules if none exist
    if (stored.length === 0) {
      const now = new Date().toISOString()
      const presetRules: AlertRule[] = (PRESET_ALERT_RULES as Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[]).map(preset => ({
        ...preset,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }))
      saveToStorage(ALERT_RULES_KEY, presetRules)
      return presetRules
    }
    return stored
  })

  // Save rules whenever they change
  useEffect(() => {
    saveToStorage(ALERT_RULES_KEY, rules)
  }, [rules])

  const createRule = useCallback((rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const newRule: AlertRule = {
      ...rule,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    setRules(prev => [...prev, newRule])
    return newRule
  }, [])

  const updateRule = useCallback((id: string, updates: Partial<AlertRule>) => {
    setRules(prev =>
      prev.map(rule =>
        rule.id === id
          ? { ...rule, ...updates, updatedAt: new Date().toISOString() }
          : rule
      )
    )
  }, [])

  const deleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id))
  }, [])

  const toggleRule = useCallback((id: string) => {
    setRules(prev =>
      prev.map(rule =>
        rule.id === id
          ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
          : rule
      )
    )
  }, [])

  return {
    rules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  }
}

// Hook for managing Slack webhooks
export function useSlackWebhooks() {
  const [webhooks, setWebhooks] = useState<SlackWebhook[]>(() =>
    loadFromStorage<SlackWebhook[]>(SLACK_WEBHOOKS_KEY, [])
  )

  useEffect(() => {
    saveToStorage(SLACK_WEBHOOKS_KEY, webhooks)
  }, [webhooks])

  const addWebhook = useCallback((name: string, webhookUrl: string, channel?: string) => {
    const webhook: SlackWebhook = {
      id: generateId(),
      name,
      webhookUrl,
      channel,
      createdAt: new Date().toISOString(),
    }
    setWebhooks(prev => [...prev, webhook])
    return webhook
  }, [])

  const removeWebhook = useCallback((id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }, [])

  return {
    webhooks,
    addWebhook,
    removeWebhook,
  }
}

// Hook for managing alerts
export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    loadFromStorage<Alert[]>(ALERTS_KEY, [])
  )
  const [isEvaluating, setIsEvaluating] = useState(false)

  const { rules } = useAlertRules()
  const { nodes: gpuNodes } = useGPUNodes()
  const { issues: podIssues } = usePodIssues()
  const { clusters } = useClusters()
  const { startMission } = useMissions()

  // Save alerts whenever they change
  useEffect(() => {
    saveToStorage(ALERTS_KEY, alerts)
  }, [alerts])

  // Calculate alert statistics
  const stats: AlertStats = useMemo(() => {
    return {
      total: alerts.length,
      firing: alerts.filter(a => a.status === 'firing').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      critical: alerts.filter(a => a.severity === 'critical' && a.status === 'firing').length,
      warning: alerts.filter(a => a.severity === 'warning' && a.status === 'firing').length,
      info: alerts.filter(a => a.severity === 'info' && a.status === 'firing').length,
      acknowledged: alerts.filter(a => a.acknowledgedAt && a.status === 'firing').length,
    }
  }, [alerts])

  // Get active (firing) alerts
  const activeAlerts = useMemo(() => {
    return alerts.filter(a => a.status === 'firing')
  }, [alerts])

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((alertId: string, acknowledgedBy?: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, acknowledgedAt: new Date().toISOString(), acknowledgedBy }
          : alert
      )
    )
  }, [])

  // Resolve an alert
  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
          : alert
      )
    )
  }, [])

  // Delete an alert
  const deleteAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }, [])

  // Create a new alert
  const createAlert = useCallback(
    (
      rule: AlertRule,
      message: string,
      details: Record<string, unknown>,
      cluster?: string,
      namespace?: string,
      resource?: string,
      resourceKind?: string
    ) => {
      // Check if similar alert already exists and is firing
      const existingAlert = alerts.find(
        a =>
          a.ruleId === rule.id &&
          a.status === 'firing' &&
          a.cluster === cluster &&
          a.resource === resource
      )

      if (existingAlert) {
        return existingAlert
      }

      const alert: Alert = {
        id: generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'firing',
        message,
        details,
        cluster,
        namespace,
        resource,
        resourceKind,
        firedAt: new Date().toISOString(),
      }

      setAlerts(prev => [alert, ...prev])
      return alert
    },
    [alerts]
  )

  // Run AI diagnosis on an alert
  const runAIDiagnosis = useCallback(
    (alertId: string) => {
      const alert = alerts.find(a => a.id === alertId)
      if (!alert) return null

      // Start a Klaude mission to diagnose the alert
      const missionId = startMission({
        title: `Diagnose: ${alert.ruleName}`,
        description: `Analyzing alert on ${alert.cluster || 'cluster'}`,
        type: 'troubleshoot',
        cluster: alert.cluster,
        initialPrompt: `Please analyze this alert and provide diagnosis with suggestions:

Alert: ${alert.ruleName}
Severity: ${alert.severity}
Message: ${alert.message}
Cluster: ${alert.cluster || 'N/A'}
Resource: ${alert.resource || 'N/A'}
Details: ${JSON.stringify(alert.details, null, 2)}

Please provide:
1. A summary of the issue
2. The likely root cause
3. Suggested actions to resolve this alert`,
        context: {
          alertId,
          alertType: alert.ruleName,
          details: alert.details,
        },
      })

      // Mark the alert as having AI analysis in progress
      setAlerts(prev =>
        prev.map(a =>
          a.id === alertId
            ? {
                ...a,
                aiDiagnosis: {
                  summary: 'Klaude is analyzing this alert...',
                  rootCause: '',
                  suggestions: [],
                  missionId,
                  analyzedAt: new Date().toISOString(),
                },
              }
            : a
        )
      )

      return missionId
    },
    [alerts, startMission]
  )

  // Evaluate alert conditions
  const evaluateConditions = useCallback(() => {
    if (isEvaluating) return
    setIsEvaluating(true)

    try {
      const enabledRules = rules.filter(r => r.enabled)

      for (const rule of enabledRules) {
        evaluateRule(rule)
      }
    } finally {
      setIsEvaluating(false)
    }
  }, [rules, gpuNodes, podIssues, clusters, createAlert, resolveAlert, isEvaluating])

  // Evaluate a single rule
  const evaluateRule = useCallback(
    (rule: AlertRule) => {
      switch (rule.condition.type) {
        case 'gpu_usage':
          evaluateGPUUsage(rule)
          break
        case 'node_not_ready':
          evaluateNodeReady(rule)
          break
        case 'pod_crash':
          evaluatePodCrash(rule)
          break
        default:
          break
      }
    },
    [gpuNodes, podIssues, clusters, createAlert, resolveAlert]
  )

  // Evaluate GPU usage condition
  const evaluateGPUUsage = useCallback(
    (rule: AlertRule) => {
      const threshold = rule.condition.threshold || 90
      const relevantClusters = rule.condition.clusters?.length
        ? clusters.filter(c => rule.condition.clusters!.includes(c.name))
        : clusters

      for (const cluster of relevantClusters) {
        const clusterGPUNodes = gpuNodes.filter(n => n.cluster.startsWith(cluster.name))
        const totalGPUs = clusterGPUNodes.reduce((sum, n) => sum + n.gpuCount, 0)
        const allocatedGPUs = clusterGPUNodes.reduce((sum, n) => sum + n.gpuAllocated, 0)

        if (totalGPUs === 0) continue

        const usagePercent = (allocatedGPUs / totalGPUs) * 100

        if (usagePercent > threshold) {
          createAlert(
            rule,
            `GPU usage is ${usagePercent.toFixed(1)}% (${allocatedGPUs}/${totalGPUs} GPUs allocated)`,
            {
              usagePercent,
              allocatedGPUs,
              totalGPUs,
              threshold,
            },
            cluster.name,
            undefined,
            'nvidia.com/gpu',
            'Resource'
          )
        } else {
          // Check if there's a firing alert for this cluster that should be resolved
          const firingAlert = alerts.find(
            a =>
              a.ruleId === rule.id &&
              a.status === 'firing' &&
              a.cluster === cluster.name
          )
          if (firingAlert) {
            resolveAlert(firingAlert.id)
          }
        }
      }
    },
    [gpuNodes, clusters, alerts, createAlert, resolveAlert]
  )

  // Evaluate node ready condition
  const evaluateNodeReady = useCallback(
    (rule: AlertRule) => {
      const relevantClusters = rule.condition.clusters?.length
        ? clusters.filter(c => rule.condition.clusters!.includes(c.name))
        : clusters

      for (const cluster of relevantClusters) {
        // Check for nodes that are not ready based on cluster health
        if (cluster.healthy === false) {
          createAlert(
            rule,
            `Cluster ${cluster.name} has nodes not in Ready state`,
            {
              clusterHealthy: cluster.healthy,
              nodeCount: cluster.nodeCount,
            },
            cluster.name,
            undefined,
            cluster.name,
            'Cluster'
          )
        } else {
          // Check if there's a firing alert for this cluster that should be resolved
          const firingAlert = alerts.find(
            a =>
              a.ruleId === rule.id &&
              a.status === 'firing' &&
              a.cluster === cluster.name
          )
          if (firingAlert) {
            resolveAlert(firingAlert.id)
          }
        }
      }
    },
    [clusters, alerts, createAlert, resolveAlert]
  )

  // Evaluate pod crash condition
  const evaluatePodCrash = useCallback(
    (rule: AlertRule) => {
      const threshold = rule.condition.threshold || 5

      for (const issue of podIssues) {
        if (issue.restarts && issue.restarts >= threshold) {
          const clusterMatch =
            !rule.condition.clusters?.length ||
            rule.condition.clusters.includes(issue.cluster || '')
          const namespaceMatch =
            !rule.condition.namespaces?.length ||
            rule.condition.namespaces.includes(issue.namespace || '')

          if (clusterMatch && namespaceMatch) {
            createAlert(
              rule,
              `Pod ${issue.name} has restarted ${issue.restarts} times (${issue.status})`,
              {
                restarts: issue.restarts,
                status: issue.status,
                reason: issue.reason,
              },
              issue.cluster,
              issue.namespace,
              issue.name,
              'Pod'
            )
          }
        }
      }
    },
    [podIssues, createAlert]
  )

  // Periodic evaluation (every 30 seconds)
  useEffect(() => {
    // Initial evaluation
    const timer = setTimeout(() => {
      evaluateConditions()
    }, 1000)

    // Periodic evaluation
    const interval = setInterval(() => {
      evaluateConditions()
    }, 30000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [evaluateConditions])

  return {
    alerts,
    activeAlerts,
    stats,
    acknowledgeAlert,
    resolveAlert,
    deleteAlert,
    runAIDiagnosis,
    evaluateConditions,
  }
}

// Hook for sending Slack notifications
export function useSlackNotification() {
  const { webhooks } = useSlackWebhooks()

  const sendNotification = useCallback(
    async (alert: Alert, webhookId: string) => {
      const webhook = webhooks.find(w => w.id === webhookId)
      if (!webhook) {
        throw new Error('Webhook not found')
      }

      const severityEmoji = {
        critical: ':red_circle:',
        warning: ':orange_circle:',
        info: ':blue_circle:',
      }

      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${severityEmoji[alert.severity]} ${alert.severity.toUpperCase()}: ${alert.ruleName}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Cluster:* ${alert.cluster || 'N/A'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Resource:* ${alert.resource || 'N/A'}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: alert.message,
            },
          },
        ],
      }

      if (alert.aiDiagnosis) {
        payload.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Klaude AI Analysis:*\n${alert.aiDiagnosis.summary}\n\n*Suggestions:*\n${alert.aiDiagnosis.suggestions.map(s => `• ${s}`).join('\n')}`,
          },
        })
      }

      try {
        // Note: In production, this should go through a backend proxy to avoid CORS
        // For now, we'll just log the intended payload
        console.log('Slack notification payload:', payload)
        // await fetch(webhook.webhookUrl, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(payload),
        // })
        return true
      } catch (error) {
        console.error('Failed to send Slack notification:', error)
        throw error
      }
    },
    [webhooks]
  )

  return { sendNotification }
}
