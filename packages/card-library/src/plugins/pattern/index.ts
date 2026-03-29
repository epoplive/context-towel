import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { PatternCard } from './PatternCard'
import type { PatternBlockData } from './types'

export type { PatternBlockData } from './types'
export { PatternCard } from './PatternCard'

export const patternBlockDefinition: BlockDefinition<PatternBlockData> = {
  type: 'pattern',
  name: 'Pattern',
  schemaVersion: 1,
  components: {
    inline: PatternCard,
    card: PatternCard,
  },
}

export function registerPatternBlock(): void {
  blockRegistry.registerOrReplace(patternBlockDefinition as any)
}
