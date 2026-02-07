import { blockRegistry } from './registry'
import type { BlockDefinition } from './types'
import { normalizeFormBlock, validateFormBlock } from './form'
import { FormCard } from '../plugins/form/FormCard'

const coreBlocks: Array<BlockDefinition<any>> = [
  { type: 'task', name: 'Task' },
  { type: 'checklist', name: 'Checklist' },
  { type: 'diagram', name: 'Diagram' },
  { type: 'log', name: 'Log' },
  { type: 'note', name: 'Note' },
  { type: 'rule', name: 'Rule' },
  { type: 'question', name: 'Question' },
  { type: 'command-result', name: 'Command Result' },
  { type: 'file-content', name: 'File Content' },
  { type: 'file-diff', name: 'File Diff' },
  { type: 'file-list', name: 'File List' },
  {
    type: 'form',
    name: 'Form',
    schemaVersion: 1,
    validate: validateFormBlock,
    toRuntime: normalizeFormBlock,
    components: {
      card: FormCard,
      inline: FormCard,
    },
  },
]

export function registerCoreBlocks(): void {
  coreBlocks.forEach(def => {
    if (!blockRegistry.has(def.type)) {
      blockRegistry.register(def)
    }
  })
}
