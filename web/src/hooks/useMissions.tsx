import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'

export type MissionStatus = 'pending' | 'running' | 'waiting_input' | 'completed' | 'failed'

export interface MissionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export type MissionFeedback = 'positive' | 'negative' | null

export interface Mission {
  id: string
  title: string
  description: string
  type: 'upgrade' | 'troubleshoot' | 'analyze' | 'deploy' | 'repair' | 'custom'
  status: MissionStatus
  progress?: number
  cluster?: string
  messages: MissionMessage[]
  createdAt: Date
  updatedAt: Date
  context?: Record<string, unknown>
  feedback?: MissionFeedback
}

interface MissionContextValue {
  missions: Mission[]
  activeMission: Mission | null
  isSidebarOpen: boolean
  isSidebarMinimized: boolean

  // Actions
  startMission: (params: StartMissionParams) => string
  sendMessage: (missionId: string, content: string) => void
  cancelMission: (missionId: string) => void
  dismissMission: (missionId: string) => void
  rateMission: (missionId: string, feedback: MissionFeedback) => void
  setActiveMission: (missionId: string | null) => void
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  minimizeSidebar: () => void
  expandSidebar: () => void
}

interface StartMissionParams {
  title: string
  description: string
  type: Mission['type']
  cluster?: string
  initialPrompt: string
  context?: Record<string, unknown>
}

const MissionContext = createContext<MissionContextValue | null>(null)

const KKC_AGENT_WS_URL = 'ws://127.0.0.1:8585/ws'

export function MissionProvider({ children }: { children: ReactNode }) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRequests = useRef<Map<string, string>>(new Map()) // requestId -> missionId

  // Connect to KKC agent WebSocket
  const ensureConnection = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      try {
        wsRef.current = new WebSocket(KKC_AGENT_WS_URL)

        wsRef.current.onopen = () => {
          console.log('[Missions] Connected to KKC agent')
          resolve()
        }

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleAgentMessage(message)
          } catch (e) {
            console.error('[Missions] Failed to parse message:', e)
          }
        }

        wsRef.current.onclose = () => {
          console.log('[Missions] Connection closed')
          wsRef.current = null
        }

        wsRef.current.onerror = () => {
          reject(new Error('Failed to connect to KKC agent'))
        }
      } catch (err) {
        reject(err)
      }
    })
  }, [])

  // Handle messages from the agent
  const handleAgentMessage = useCallback((message: { id: string; type: string; payload?: unknown }) => {
    const missionId = pendingRequests.current.get(message.id)
    if (!missionId) return

    setMissions(prev => prev.map(m => {
      if (m.id !== missionId) return m

      if (message.type === 'stream') {
        // Streaming response from Claude
        const payload = message.payload as { content?: string; done?: boolean }
        const lastMsg = m.messages[m.messages.length - 1]

        if (lastMsg?.role === 'assistant' && !payload.done) {
          // Append to existing assistant message
          return {
            ...m,
            status: 'running' as MissionStatus,
            updatedAt: new Date(),
            messages: [
              ...m.messages.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + (payload.content || '') }
            ]
          }
        } else if (payload.done) {
          // Stream complete
          pendingRequests.current.delete(message.id)
          return {
            ...m,
            status: 'waiting_input' as MissionStatus,
            updatedAt: new Date(),
          }
        }
      } else if (message.type === 'result') {
        // Complete response
        const payload = message.payload as { content?: string; output?: string }
        pendingRequests.current.delete(message.id)

        return {
          ...m,
          status: 'waiting_input' as MissionStatus,
          updatedAt: new Date(),
          messages: [
            ...m.messages,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: payload.content || payload.output || 'Task completed.',
              timestamp: new Date(),
            }
          ]
        }
      } else if (message.type === 'error') {
        const payload = message.payload as { message?: string }
        pendingRequests.current.delete(message.id)

        return {
          ...m,
          status: 'failed' as MissionStatus,
          updatedAt: new Date(),
          messages: [
            ...m.messages,
            {
              id: `msg-${Date.now()}`,
              role: 'system' as const,
              content: `Error: ${payload.message || 'Unknown error'}`,
              timestamp: new Date(),
            }
          ]
        }
      }

      return m
    }))
  }, [])

  // Start a new mission
  const startMission = useCallback((params: StartMissionParams): string => {
    const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const mission: Mission = {
      id: missionId,
      title: params.title,
      description: params.description,
      type: params.type,
      status: 'pending',
      cluster: params.cluster,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: params.initialPrompt,
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      context: params.context,
    }

    setMissions(prev => [mission, ...prev])
    setActiveMissionId(missionId)
    setIsSidebarOpen(true)

    // Send to agent
    ensureConnection().then(() => {
      const requestId = `claude-${Date.now()}`
      pendingRequests.current.set(requestId, missionId)

      setMissions(prev => prev.map(m =>
        m.id === missionId ? { ...m, status: 'running' } : m
      ))

      wsRef.current?.send(JSON.stringify({
        id: requestId,
        type: 'claude',
        payload: {
          prompt: params.initialPrompt,
          sessionId: missionId,
        }
      }))
    }).catch(err => {
      setMissions(prev => prev.map(m =>
        m.id === missionId ? {
          ...m,
          status: 'failed',
          messages: [
            ...m.messages,
            {
              id: `msg-${Date.now()}`,
              role: 'system',
              content: `Failed to connect to KKC agent: ${err.message}`,
              timestamp: new Date(),
            }
          ]
        } : m
      ))
    })

    return missionId
  }, [ensureConnection])

  // Send a follow-up message
  const sendMessage = useCallback((missionId: string, content: string) => {
    setMissions(prev => prev.map(m => {
      if (m.id !== missionId) return m
      return {
        ...m,
        status: 'running',
        updatedAt: new Date(),
        messages: [
          ...m.messages,
          {
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date(),
          }
        ]
      }
    }))

    ensureConnection().then(() => {
      const requestId = `claude-${Date.now()}`
      pendingRequests.current.set(requestId, missionId)

      wsRef.current?.send(JSON.stringify({
        id: requestId,
        type: 'claude',
        payload: {
          prompt: content,
          sessionId: missionId,
        }
      }))
    })
  }, [ensureConnection])

  // Cancel a running mission
  const cancelMission = useCallback((missionId: string) => {
    setMissions(prev => prev.map(m =>
      m.id === missionId ? {
        ...m,
        status: 'failed',
        updatedAt: new Date(),
        messages: [
          ...m.messages,
          {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: 'Mission cancelled by user.',
            timestamp: new Date(),
          }
        ]
      } : m
    ))
  }, [])

  // Dismiss/remove a mission from the list
  const dismissMission = useCallback((missionId: string) => {
    setMissions(prev => prev.filter(m => m.id !== missionId))
    if (activeMissionId === missionId) {
      setActiveMissionId(null)
    }
  }, [activeMissionId])

  // Rate a mission (thumbs up/down feedback)
  const rateMission = useCallback((missionId: string, feedback: MissionFeedback) => {
    setMissions(prev => prev.map(m =>
      m.id === missionId ? { ...m, feedback, updatedAt: new Date() } : m
    ))
    // TODO: Send feedback to analytics endpoint when available
    console.log(`[Missions] Feedback for ${missionId}: ${feedback}`)
  }, [])

  // Set active mission
  const setActiveMission = useCallback((missionId: string | null) => {
    setActiveMissionId(missionId)
    if (missionId) {
      setIsSidebarOpen(true)
    }
  }, [])

  // Sidebar controls
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), [])
  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true)
    setIsSidebarMinimized(false) // Expand when opening
  }, [])
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])
  const minimizeSidebar = useCallback(() => setIsSidebarMinimized(true), [])
  const expandSidebar = useCallback(() => setIsSidebarMinimized(false), [])

  // Get active mission object
  const activeMission = missions.find(m => m.id === activeMissionId) || null

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return (
    <MissionContext.Provider value={{
      missions,
      activeMission,
      isSidebarOpen,
      isSidebarMinimized,
      startMission,
      sendMessage,
      cancelMission,
      dismissMission,
      rateMission,
      setActiveMission,
      toggleSidebar,
      openSidebar,
      closeSidebar,
      minimizeSidebar,
      expandSidebar,
    }}>
      {children}
    </MissionContext.Provider>
  )
}

export function useMissions() {
  const context = useContext(MissionContext)
  if (!context) {
    throw new Error('useMissions must be used within a MissionProvider')
  }
  return context
}
