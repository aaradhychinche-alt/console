import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, Clock, X, ChevronRight, Zap, AlertTriangle, Shield, Server, Scale, Activity } from 'lucide-react'
import { useMissionSuggestions, MissionSuggestion, MissionType } from '../../hooks/useMissionSuggestions'
import { useSnoozedMissions, formatTimeRemaining } from '../../hooks/useSnoozedMissions'
import { useMissions } from '../../hooks/useMissions'

const MISSION_ICONS: Record<MissionType, typeof Zap> = {
  scale: Scale,
  limits: Activity,
  restart: Zap,
  unavailable: AlertTriangle,
  security: Shield,
  health: Server,
  resource: Activity,
}

const PRIORITY_STYLES = {
  critical: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/30',
  },
  high: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500/30',
  },
  medium: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/30',
  },
  low: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/30',
  },
}

export function MissionSuggestions() {
  const navigate = useNavigate()
  const { suggestions, hasSuggestions, stats } = useMissionSuggestions()
  const { snoozeMission, dismissMission, getSnoozeRemaining } = useSnoozedMissions()
  const { startMission } = useMissions()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleAction = async (suggestion: MissionSuggestion) => {
    setProcessingId(suggestion.id)

    try {
      if (suggestion.action.type === 'navigate') {
        navigate(suggestion.action.target)
      } else if (suggestion.action.type === 'klaude') {
        // Start a Klaude mission with the suggestion
        startMission({
          title: suggestion.title,
          description: suggestion.description,
          type: suggestion.type === 'security' ? 'analyze' : 'troubleshoot',
          initialPrompt: suggestion.action.target,
          context: suggestion.context,
        })
      }
    } finally {
      setProcessingId(null)
      setExpandedId(null)
    }
  }

  const handleSnooze = (suggestion: MissionSuggestion) => {
    snoozeMission(suggestion)
    setExpandedId(null)
  }

  const handleDismiss = (suggestion: MissionSuggestion) => {
    dismissMission(suggestion.id)
    setExpandedId(null)
  }

  if (!hasSuggestions) return null

  return (
    <div data-tour="mission-suggestions" className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-medium text-foreground">Suggested Actions</h3>
        {stats.critical > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
            {stats.critical} critical
          </span>
        )}
        {stats.high > 0 && stats.critical === 0 && (
          <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs">
            {stats.high} high priority
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {suggestions.slice(0, 4).map((suggestion) => {
          const Icon = MISSION_ICONS[suggestion.type]
          const style = PRIORITY_STYLES[suggestion.priority]
          const isExpanded = expandedId === suggestion.id
          const isProcessing = processingId === suggestion.id
          const snoozeRemaining = getSnoozeRemaining(suggestion.id)

          return (
            <div
              key={suggestion.id}
              className={`rounded-lg border ${style.border} ${style.bg} transition-all ${
                isExpanded ? 'w-full md:w-96' : 'w-auto'
              }`}
            >
              {/* Collapsed/Header view */}
              <div
                className={`p-3 cursor-pointer ${isExpanded ? '' : 'hover:scale-105'} transition-transform`}
                onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${style.text}`} />
                  <span className="font-medium text-sm text-foreground">{suggestion.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${style.badge} ${style.text}`}>
                    {suggestion.priority}
                  </span>
                  {isProcessing && (
                    <div className="ml-auto spinner w-4 h-4" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                {!isExpanded && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3" />
                    <span>Click to expand</span>
                  </div>
                )}
                {snoozeRemaining && snoozeRemaining > 0 && (
                  <div className="mt-1 text-xs text-purple-400">
                    Snoozed for {formatTimeRemaining(snoozeRemaining)}
                  </div>
                )}
              </div>

              {/* Expanded view with details and actions */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-current/20 mt-2 pt-3">
                  {/* Context details */}
                  {suggestion.context.details && suggestion.context.details.length > 0 && (
                    <div className="text-xs text-muted-foreground mb-3">
                      <strong className="text-foreground">Details:</strong>
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        {suggestion.context.details.slice(0, 3).map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                        {suggestion.context.details.length > 3 && (
                          <li className="text-muted-foreground/70">
                            ...and {suggestion.context.details.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(suggestion)}
                      disabled={isProcessing}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        suggestion.priority === 'critical'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : suggestion.priority === 'high'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="spinner w-4 h-4" /> Processing...
                        </span>
                      ) : (
                        suggestion.action.label
                      )}
                    </button>
                    <button
                      onClick={() => handleSnooze(suggestion)}
                      className="px-3 py-2 rounded-lg text-sm font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors flex items-center gap-1"
                      title="Snooze for 24 hours"
                    >
                      <Clock className="w-4 h-4" />
                      Snooze
                    </button>
                    <button
                      onClick={() => handleDismiss(suggestion)}
                      className="px-3 py-2 rounded-lg text-sm font-medium bg-secondary/50 hover:bg-secondary transition-colors"
                      title="Dismiss this suggestion"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {suggestions.length > 4 && (
        <div className="mt-2 text-xs text-muted-foreground">
          +{suggestions.length - 4} more suggestions
        </div>
      )}
    </div>
  )
}
