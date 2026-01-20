import { Plus, Layout } from 'lucide-react'

interface FloatingDashboardActionsProps {
  onAddCard: () => void
  onOpenTemplates: () => void
}

/**
 * Floating action buttons for Add Card and Templates.
 * These buttons stay fixed at the bottom right of the viewport
 * so users can always access them when scrolling through dashboards.
 */
export function FloatingDashboardActions({ onAddCard, onOpenTemplates }: FloatingDashboardActionsProps) {
  return (
    <div className="fixed bottom-20 right-6 z-40 flex flex-col gap-1.5">
      {/* Templates button */}
      <button
        onClick={onOpenTemplates}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-card/95 hover:bg-card border border-border rounded-md shadow-md backdrop-blur-sm transition-all hover:shadow-lg"
        title="Browse dashboard templates"
      >
        <Layout className="w-3.5 h-3.5" />
        Templates
      </button>
      {/* Add Card button */}
      <button
        onClick={onAddCard}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-ks text-foreground rounded-md shadow-md transition-all hover:shadow-lg hover:scale-105"
        title="Add a new card"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Card
      </button>
    </div>
  )
}
