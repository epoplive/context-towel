// ============================================================================
// Plugin Registry - Manages all parser plugins
// ============================================================================

import { ExtractedItem, ParseResult } from '../types'
import { ParserPlugin, PluginInfo, ContextOptions } from './types'

class PluginRegistry {
  private plugins: Map<string, ParserPlugin> = new Map()
  private parseOrder: string[] = []

  /**
   * Register a plugin. Throws if plugin ID already exists or dependencies missing.
   */
  register<T extends ExtractedItem>(plugin: ParserPlugin<T>): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" already registered`)
    }

    // Validate dependencies exist
    for (const dep of plugin.dependencies ?? []) {
      if (!this.plugins.has(dep)) {
        throw new Error(
          `Plugin "${plugin.id}" requires "${dep}" which is not registered. ` +
          `Register "${dep}" first.`
        )
      }
    }

    this.plugins.set(plugin.id, plugin as unknown as ParserPlugin)
    this.rebuildParseOrder()
  }

  /**
   * Unregister a plugin by ID
   */
  unregister(id: string): void {
    if (!this.plugins.has(id)) {
      throw new Error(`Plugin "${id}" is not registered`)
    }

    // Check if any other plugin depends on this one
    for (const [otherId, plugin] of this.plugins) {
      if (plugin.dependencies?.includes(id)) {
        throw new Error(
          `Cannot unregister "${id}" because "${otherId}" depends on it`
        )
      }
    }

    this.plugins.delete(id)
    this.rebuildParseOrder()
  }

  /**
   * Get a plugin by ID. Throws if not found.
   */
  get<T extends ExtractedItem>(id: string): ParserPlugin<T> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`Plugin "${id}" not found`)
    }
    return plugin as unknown as ParserPlugin<T>
  }

  /**
   * Check if a plugin is registered
   */
  has(id: string): boolean {
    return this.plugins.has(id)
  }

  /**
   * Get all registered plugins in parse order
   */
  all(): ParserPlugin[] {
    return this.parseOrder.map(id => this.plugins.get(id)!)
  }

  /**
   * Get plugin info for all registered plugins
   */
  list(): PluginInfo[] {
    return this.all().map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      supportedContexts: p.supportedContexts,
      nodeType: p.nodeType,
    }))
  }

  /**
   * Parse content through all plugins that detect matches
   */
  parseAll(content: string, sourceFile: string): Map<string, ParseResult<ExtractedItem>> {
    const results = new Map<string, ParseResult<ExtractedItem>>()

    for (const id of this.parseOrder) {
      const plugin = this.plugins.get(id)!
      if (plugin.detect(content)) {
        results.set(id, plugin.parse(content, sourceFile))
      }
    }

    return results
  }

  /**
   * Parse content with a specific plugin
   */
  parseWith<T extends ExtractedItem>(
    pluginId: string,
    content: string,
    sourceFile: string
  ): ParseResult<T> {
    const plugin = this.get<T>(pluginId)
    return plugin.parse(content, sourceFile)
  }

  /**
   * Generate context markdown from all parse results
   */
  toContextMarkdown(
    results: Map<string, ParseResult<ExtractedItem>>,
    options?: ContextOptions
  ): string {
    const sections: string[] = []

    for (const [id, result] of results) {
      if (!result?.items || result.items.length === 0) continue

      const plugin = this.plugins.get(id)
      if (!plugin) continue

      sections.push(plugin.toContextMarkdown(result.items, options))
    }

    return sections.join('\n\n')
  }

  /**
   * Get node types for ReactFlow registration
   */
  getNodeTypes(): Record<string, React.ComponentType<any>> {
    const nodeTypes: Record<string, React.ComponentType<any>> = {}

    for (const plugin of this.plugins.values()) {
      const component = plugin.getComponent('graph-node')
      if (component) {
        nodeTypes[plugin.nodeType] = component
      }
    }

    return nodeTypes
  }

  /**
   * Rebuild parse order based on priority
   */
  private rebuildParseOrder(): void {
    // Sort by priority (higher = earlier), then alphabetically for stability
    this.parseOrder = Array.from(this.plugins.keys()).sort((a, b) => {
      const pA = this.plugins.get(a)!.priority ?? 0
      const pB = this.plugins.get(b)!.priority ?? 0
      if (pA !== pB) return pB - pA
      return a.localeCompare(b)
    })
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry()
