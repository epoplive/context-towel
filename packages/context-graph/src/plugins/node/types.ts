// ============================================================================
// Node Plugin Types
// ============================================================================

import { ExtractedItem } from '../../types'

export type NodeState = 'active' | 'success' | 'failed'

export interface NodeItem extends ExtractedItem {
  nodeId: string
  state: NodeState
  layer?: string
  subsystem?: string
  body: string
}

export const nodeStateColors: Record<NodeState, string> = {
  active: '#3b82f6',
  success: '#22c55e',
  failed: '#ef4444',
}

export function getNodeStateColor(state: NodeState): string {
  return nodeStateColors[state] ?? '#6b7280'
}
