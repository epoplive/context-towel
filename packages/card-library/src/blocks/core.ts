import { blockRegistry } from './registry'
import type { BlockDefinition } from './types'
import { normalizeFormBlock, validateFormBlock } from './form'

const coreBlocks: Array<BlockDefinition<any>> = [
  { type: 'task', name: 'Task' },
  { type: 'checklist', name: 'Checklist' },
  { type: 'diagram', name: 'Diagram' },
  { type: 'log', name: 'Log' },
  {
    type: 'form',
    name: 'Form',
    schemaVersion: 1,
    validate: validateFormBlock,
    toRuntime: normalizeFormBlock,
  },
]

export function registerCoreBlocks(): void {
  coreBlocks.forEach(def => {
    if (!blockRegistry.has(def.type)) {
      blockRegistry.register(def)
    }
  })
}
