import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { DependencyGraphCard } from './DependencyGraphCard'
import type { DepGraphData } from './types'

export type { DepGraphData, DepGraphTask, DepGraphTaskStatus, DepGraphTaskPriority } from './types'
export { DEP_STATUS_COLORS, DEP_PRIORITY_COLORS, DEP_STATUS_LABELS } from './types'
export { DependencyGraphCard } from './DependencyGraphCard'
export { computeDepGraphLayout, getDependencyChain, hasCycleInGraph } from './layout'

/** Dependency graph block definition */
export const dependencyGraphBlockDefinition: BlockDefinition<DepGraphData> = {
  type: 'dependency-graph',
  name: 'Dependency Graph',
  schemaVersion: 1,
  components: {
    card: DependencyGraphCard,
    inline: DependencyGraphCard,
  },
}

/** Register the dependency-graph block plugin in the card library registry */
export function registerDependencyGraphBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(dependencyGraphBlockDefinition as any)
}
