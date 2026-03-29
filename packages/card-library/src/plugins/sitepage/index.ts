import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { SitePageCard } from './SitePageCard'
import type { SitePageBlockData } from './types'

export type { SitePageBlockData } from './types'
export { SitePageCard } from './SitePageCard'

export const sitePageBlockDefinition: BlockDefinition<SitePageBlockData> = {
  type: 'sitepage',
  name: 'Site Page',
  schemaVersion: 1,
  components: {
    inline: SitePageCard,
    card: SitePageCard,
  },
}

export function registerSitePageBlock(): void {
  blockRegistry.registerOrReplace(sitePageBlockDefinition as any)
}
