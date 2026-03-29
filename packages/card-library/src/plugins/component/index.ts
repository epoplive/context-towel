import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { ComponentCard } from './ComponentCard'
import type { ComponentBlockData } from './types'

export type { ComponentBlockData } from './types'
export { ComponentCard } from './ComponentCard'

export const componentBlockDefinition: BlockDefinition<ComponentBlockData> = {
  type: 'component',
  name: 'Component',
  schemaVersion: 1,
  components: {
    inline: ComponentCard,
    card: ComponentCard,
  },
}

export function registerComponentBlock(): void {
  blockRegistry.registerOrReplace(componentBlockDefinition as any)
}
