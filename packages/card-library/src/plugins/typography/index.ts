import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { TypographyCard } from './TypographyCard'
import type { TypographyBlockData } from './types'

export type { TypographyBlockData } from './types'
export { TypographyCard } from './TypographyCard'

export const typographyBlockDefinition: BlockDefinition<TypographyBlockData> = {
  type: 'typography',
  name: 'Typography',
  schemaVersion: 1,
  components: {
    inline: TypographyCard,
    card: TypographyCard,
  },
}

export function registerTypographyBlock(): void {
  blockRegistry.registerOrReplace(typographyBlockDefinition as any)
}
