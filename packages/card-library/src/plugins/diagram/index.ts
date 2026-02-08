import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { DiagramCard } from './DiagramCard'
import type { DiagramData } from './types'

export type { DiagramData } from './types'
export { diagramTypeColors } from './types'
export { DiagramCard } from './DiagramCard'

export const diagramBlockDefinition: BlockDefinition<DiagramData> = {
  type: 'diagram',
  name: 'Diagram',
  components: {
    inline: DiagramCard,
    card: DiagramCard,
  },
}

export function registerDiagramBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(diagramBlockDefinition as any)
}
