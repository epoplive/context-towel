/** Node state — lifecycle state of a context node */
export type NodeState = 'active' | 'success' | 'failed'

/** Zoom layer — semantic zoom level in the context graph */
export type ZoomLayer = 'continent' | 'region' | 'district' | 'street' | 'ground'

/** Data for a ~~~node block */
export interface NodeBlockData {
  id: string
  state: NodeState
  layer?: ZoomLayer
  subsystem?: string
  maps?: string
  body: string
}

/** Data for a ~~~node-map block */
export interface NodeMapBlockData {
  id: string
  body: string
}

/** State color mapping */
export const nodeStateColors: Record<NodeState, string> = {
  active: '#3b82f6',
  success: '#22c55e',
  failed: '#ef4444',
}

/** Zoom layer display labels */
export const zoomLayerLabels: Record<ZoomLayer, string> = {
  continent: 'Continent',
  region: 'Region',
  district: 'District',
  street: 'Street',
  ground: 'Ground',
}
