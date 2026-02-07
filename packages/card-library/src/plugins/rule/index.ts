import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { RuleCard } from './RuleCard'
import type { RuleData } from './types'

export type { RuleData } from './types'
export { ruleTypeColors } from './types'
export { RuleCard } from './RuleCard'

/** Rule block definition for the card library registry */
export const ruleBlockDefinition: BlockDefinition<RuleData> = {
  type: 'rule',
  name: 'Rule',
  schemaVersion: 1,
  components: {
    inline: RuleCard,
    card: RuleCard,
  },
  toContextMarkdown(blocks) {
    const rules = blocks
      .filter((b) => b.data !== null)
      .map((b) => b.data!)

    if (rules.length === 0) return ''

    const lines: string[] = ['### Rules']
    for (const rule of rules) {
      lines.push(`- **${rule.name}** (${rule.ruleType || 'coding_pattern'}) - Priority: ${rule.priority ?? 5}`)
      if (rule.description) {
        lines.push(`  ${rule.description}`)
      }
    }

    return lines.join('\n')
  },
}

/** Register the rule block plugin in the card library registry */
export function registerRuleBlock(): void {
  if (!blockRegistry.has('rule')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockRegistry.register(ruleBlockDefinition as any)
  }
}
