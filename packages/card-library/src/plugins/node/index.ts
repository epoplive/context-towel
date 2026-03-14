import { blockRegistry } from '../../blocks/registry.js'
import type { BlockDefinition } from '../../blocks/types.js'
import type { NodeBlockData, NodeMapBlockData } from './types.js'
import { NodeCard } from './NodeCard.js'

export type { NodeBlockData, NodeMapBlockData, NodeState, ZoomLayer } from './types.js'
export { nodeStateColors, zoomLayerLabels } from './types.js'
export { NodeCard } from './NodeCard.js'

/** Node block definition — YAML header + --- + opaque body */
export const nodeBlockDefinition: BlockDefinition<NodeBlockData> = {
  type: 'node',
  name: 'Node',
  schemaVersion: 1,
  components: {
    inline: NodeCard,
    card: NodeCard,
  },
  serialize: (data: NodeBlockData) => {
    const lines: string[] = []
    lines.push(`id: ${data.id}`)
    if (data.state) lines.push(`state: ${data.state}`)
    if (data.layer) lines.push(`layer: ${data.layer}`)
    if (data.subsystem) lines.push(`subsystem: ${data.subsystem}`)
    if (data.maps) lines.push(`maps: ${data.maps}`)
    lines.push('---')
    lines.push(data.body)
    return lines.join('\n')
  },
}

/** Node-map block definition — id header + --- + symbol map body */
export const nodeMapBlockDefinition: BlockDefinition<NodeMapBlockData> = {
  type: 'node-map',
  name: 'Node Map',
  schemaVersion: 1,
  serialize: (data: NodeMapBlockData) => {
    return `id: ${data.id}\n---\n${data.body}`
  },
}

/** Register the node block plugin */
export function registerNodeBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(nodeBlockDefinition as any)
}

/** Register the node-map block plugin */
export function registerNodeMapBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(nodeMapBlockDefinition as any)
}
