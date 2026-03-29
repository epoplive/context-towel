import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { CompetitorCard } from './CompetitorCard'
import type { CompetitorBlockData } from './types'

export type { CompetitorBlockData } from './types'
export { CompetitorCard } from './CompetitorCard'

export const competitorBlockDefinition: BlockDefinition<CompetitorBlockData> = {
  type: 'competitor',
  name: 'Competitor',
  schemaVersion: 1,
  components: {
    inline: CompetitorCard,
    card: CompetitorCard,
  },
}

export function registerCompetitorBlock(): void {
  blockRegistry.registerOrReplace(competitorBlockDefinition as any)
}
