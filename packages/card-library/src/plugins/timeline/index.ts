import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { TimelineCard } from './TimelineCard'
import type { TimelineData } from './types'

export type { TimelineData, TimelinePhase, TimelineTask, TimelineStatus } from './types'
export {
  TIMELINE_STATUS_LABELS,
  TIMELINE_STATUS_COLORS,
  parseDateMs,
  formatDateLabel,
} from './types'
export { TimelineCard } from './TimelineCard'

/** Timeline block definition */
export const timelineBlockDefinition: BlockDefinition<TimelineData> = {
  type: 'timeline',
  name: 'Timeline',
  schemaVersion: 1,
  components: {
    inline: TimelineCard,
    card: TimelineCard,
  },
}

/** Register the timeline block plugin in the card library registry */
export function registerTimelineBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(timelineBlockDefinition as any)
}
