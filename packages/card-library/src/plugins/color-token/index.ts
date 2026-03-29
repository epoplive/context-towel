import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { ColorTokenCard } from './ColorTokenCard'
import type { ColorTokenBlockData } from './types'

export type { ColorTokenBlockData } from './types'
export { ColorTokenCard } from './ColorTokenCard'

export const colorTokenBlockDefinition: BlockDefinition<ColorTokenBlockData> = {
  type: 'color-token',
  name: 'Color Token',
  schemaVersion: 1,
  components: {
    inline: ColorTokenCard,
    card: ColorTokenCard,
  },
}

export function registerColorTokenBlock(): void {
  blockRegistry.registerOrReplace(colorTokenBlockDefinition as any)
}
