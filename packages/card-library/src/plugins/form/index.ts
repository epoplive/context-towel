import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { normalizeFormBlock, validateFormBlock } from '../../blocks/form'
import { FormCard } from './FormCard'
import type { FormBlockData } from '../../blocks/form'

export { FormCard } from './FormCard'

export const formBlockDefinition: BlockDefinition<FormBlockData> = {
  type: 'form',
  name: 'Form',
  schemaVersion: 1,
  validate: validateFormBlock,
  toRuntime: normalizeFormBlock,
  components: {
    inline: FormCard,
    card: FormCard,
  },
  toContextMarkdown(blocks) {
    const forms = blocks
      .filter((b) => b.data !== null)
      .map((b) => b.data!)
    if (forms.length === 0) return ''
    const lines: string[] = []
    for (const form of forms) {
      if (form.title) lines.push(`### ${form.title}`)
      if (form.description) lines.push(form.description)
      if (form.responses && Object.keys(form.responses).length > 0) {
        lines.push('**Responses:**')
        for (const [key, val] of Object.entries(form.responses)) {
          lines.push(`- ${key}: ${val}`)
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  },
}

export function registerFormBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(formBlockDefinition as any)
}
