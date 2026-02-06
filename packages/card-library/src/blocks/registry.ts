import type { BlockDefinition, BlockTypeId } from './types'

class BlockRegistry {
  private definitions = new Map<BlockTypeId, BlockDefinition>()

  register(definition: BlockDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Block type already registered: ${definition.type}`)
    }
    this.definitions.set(definition.type, definition)
  }

  has(type: BlockTypeId): boolean {
    return this.definitions.has(type)
  }

  get(type: BlockTypeId): BlockDefinition | undefined {
    return this.definitions.get(type)
  }

  list(): BlockDefinition[] {
    return Array.from(this.definitions.values())
  }

  clear(): void {
    this.definitions.clear()
  }
}

export const blockRegistry = new BlockRegistry()
export type { BlockRegistry }
