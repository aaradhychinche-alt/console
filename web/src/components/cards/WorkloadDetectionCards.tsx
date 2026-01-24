import { useState, useEffect } from 'react'
import { CardWrapper } from './CardWrapper'
import { useGlobalFilters } from '../../hooks/useGlobalFilters'
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Brain,
  BookOpen,
  History,
} from 'lucide-react'

// Prow Jobs Card - shows CI/CD jobs from Prow
export function ProwJobs() {
  const { selectedClusters } = useGlobalFilters()
  const [jobs, setJobs] = useState<Array<{
    name: string
    type: string
    state: string
    startTime: string
    duration: string
    repo: string
  }>>([])

  useEffect(() => {
    // Demo data - would connect to Prow API in production
    setJobs([
      { name: 'pull-kubernetes-e2e', type: 'presubmit', state: 'success', startTime: '10m ago', duration: '25m', repo: 'kubernetes/kubernetes' },
      { name: 'ci-kubernetes-build', type: 'periodic', state: 'running', startTime: '5m ago', duration: '-', repo: 'kubernetes/kubernetes' },
      { name: 'pull-test-infra-verify', type: 'presubmit', state: 'failure', startTime: '15m ago', duration: '8m', repo: 'kubernetes/test-infra' },
    ])
  }, [selectedClusters])

  return (
    <CardWrapper cardType="prow_jobs" title="Prow Jobs" isDemoData>
      <div className="space-y-2">
        {jobs.map((job, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary/30">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{job.name}</div>
                <div className="text-xs text-muted-foreground">{job.repo}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{job.type}</span>
              {job.state === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {job.state === 'failure' && <XCircle className="w-4 h-4 text-red-400" />}
              {job.state === 'running' && <Clock className="w-4 h-4 text-blue-400 animate-pulse" />}
            </div>
          </div>
        ))}
      </div>
    </CardWrapper>
  )
}

// Prow Status Card - shows Prow controller status
export function ProwStatus() {
  return (
    <CardWrapper cardType="prow_status" title="Prow Status" isDemoData>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Controller</span>
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Healthy
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Deck</span>
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Healthy
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Hook</span>
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Healthy
          </span>
        </div>
      </div>
    </CardWrapper>
  )
}

// Prow History Card - shows recent job history
export function ProwHistory() {
  return (
    <CardWrapper cardType="prow_history" title="Prow History" isDemoData>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <History className="w-4 h-4 text-muted-foreground" />
          <span>Last 24h: 156 jobs, 94% success rate</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <History className="w-4 h-4 text-muted-foreground" />
          <span>Last 7d: 1,024 jobs, 91% success rate</span>
        </div>
      </div>
    </CardWrapper>
  )
}

// LLM Inference Card - shows LLM inference workloads
export function LLMInference() {
  return (
    <CardWrapper cardType="llm_inference" title="LLM Inference" isDemoData>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-sm">vLLM Serving</span>
          </div>
          <span className="text-xs text-green-400">4 replicas</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-sm">TGI Server</span>
          </div>
          <span className="text-xs text-green-400">2 replicas</span>
        </div>
      </div>
    </CardWrapper>
  )
}

// LLM Models Card - shows deployed LLM models
export function LLMModels() {
  return (
    <CardWrapper cardType="llm_models" title="LLM Models" isDemoData>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-sm">Llama-2-70B</span>
          <span className="text-xs text-muted-foreground">4x A100</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-sm">Mistral-7B</span>
          <span className="text-xs text-muted-foreground">1x A100</span>
        </div>
      </div>
    </CardWrapper>
  )
}

// ML Jobs Card - shows ML training jobs
export function MLJobs() {
  return (
    <CardWrapper cardType="ml_jobs" title="ML Jobs" isDemoData>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-sm">fine-tune-llama</span>
          </div>
          <span className="text-xs text-yellow-400">Running</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-sm">eval-mistral</span>
          </div>
          <span className="text-xs text-green-400">Complete</span>
        </div>
      </div>
    </CardWrapper>
  )
}

// ML Notebooks Card - shows Jupyter notebooks
export function MLNotebooks() {
  return (
    <CardWrapper cardType="ml_notebooks" title="ML Notebooks" isDemoData>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-400" />
            <span className="text-sm">research-notebook-1</span>
          </div>
          <span className="text-xs text-green-400">Running</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-400" />
            <span className="text-sm">data-analysis</span>
          </div>
          <span className="text-xs text-muted-foreground">Stopped</span>
        </div>
      </div>
    </CardWrapper>
  )
}
