import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { KanbanCard } from './KanbanCard'
import type { KanbanData } from './types'

export type { KanbanData, KanbanTask, KanbanGroupBy, KanbanTaskStatus, KanbanTaskPriority } from './types'
export {
  KANBAN_STATUS_LABELS,
  KANBAN_PRIORITY_LABELS,
  KANBAN_STATUS_COLORS,
  KANBAN_PRIORITY_COLORS,
  STATUS_COLUMN_ORDER,
  PRIORITY_COLUMN_ORDER,
} from './types'
export { KanbanCard } from './KanbanCard'

/** Kanban block definition */
export const kanbanBlockDefinition: BlockDefinition<KanbanData> = {
  type: 'kanban',
  name: 'Kanban',
  schemaVersion: 1,
  components: {
    inline: KanbanCard,
    card: KanbanCard,
  },
}

/** Register the kanban block plugin in the card library registry */
export function registerKanbanBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(kanbanBlockDefinition as any)
}
