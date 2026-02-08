import type { BlockDefinition, BlockTypeId } from './types'

class BlockRegistry {
  private definitions = new Map<BlockTypeId, BlockDefinition>()

  register(definition: BlockDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Block type already registered: ${definition.type}`)
    }
    this.definitions.set(definition.type, definition)
  }

  /**
   * Register a definition, replacing an existing "stub" definition if needed.
   *
   * This exists because `registerCoreBlocks()` seeds the registry with minimal
   * definitions (name only) so parsing/validation can work even if plugins
   * haven't loaded. Later, richer plugin definitions (with render components)
   * must be able to override those stubs.
   */
  registerOrReplace(definition: BlockDefinition): void {
    const existing = this.definitions.get(definition.type)
    if (!existing) {
      this.definitions.set(definition.type, definition)
      return
    }

    const existingHasComponents = Boolean(existing.components && Object.keys(existing.components).length > 0)
    const nextHasComponents = Boolean(definition.components && Object.keys(definition.components).length > 0)

    // Upgrade stub -> full definition (plugins override core stubs).
    if (!existingHasComponents && nextHasComponents) {
      this.definitions.set(definition.type, definition)
    }
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
