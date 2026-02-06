import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { ChecklistCard } from './ChecklistCard'
import type { ChecklistGroupData } from './types'

export type { ChecklistGroupData, ChecklistItemData } from './types'
export { ChecklistCard } from './ChecklistCard'

export const checklistBlockDefinition: BlockDefinition<ChecklistGroupData> = {
  type: 'checklist',
  name: 'Checklist',
  components: {
    inline: ChecklistCard,
    card: ChecklistCard,
  },
  toContextMarkdown(blocks) {
    const groups = blocks.filter((b) => b.data !== null).map((b) => b.data!)
    if (groups.length === 0) return ''
    const lines: string[] = []
    for (const group of groups) {
      lines.push(`### ${group.title}`)
      for (const item of group.items) {
        lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`)
      }
    }
    return lines.join('\n')
  },
}

export function registerChecklistBlock(): void {
  if (!blockRegistry.has('checklist')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockRegistry.register(checklistBlockDefinition as any)
  }
}
