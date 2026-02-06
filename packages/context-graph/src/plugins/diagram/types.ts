// ============================================================================
// Diagram Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export interface DiagramItem extends ExtractedItem {
  title: string           // Section heading where diagram was found
  code: string            // Mermaid diagram code
  diagramType: string     // graph, flowchart, sequenceDiagram, etc.
}

export function getDiagramTypeColor(diagramType: string): string {
  switch (diagramType.toLowerCase()) {
    case 'graph':
    case 'flowchart': return '#3b82f6'
    case 'sequencediagram': return '#8b5cf6'
    case 'classdiagram': return '#ec4899'
    case 'statediagram': return '#f97316'
    case 'erdiagram': return '#14b8a6'
    case 'gantt': return '#84cc16'
    case 'pie': return '#f59e0b'
    case 'mindmap': return '#06b6d4'
    default: return '#6b7280'
  }
}
