/**
 * Lazy plugin registration to avoid circular dependencies.
 *
 * The circular dependency chain is:
 *   store.ts → plugins/index.ts → task/index.ts → task/components.tsx → useGraphStore → store.ts
 *
 * By deferring plugin registration until first use, we break the cycle.
 */

let pluginsRegistered = false

/**
 * Ensure built-in plugins are registered.
 * Safe to call multiple times - only registers once.
 */
export function ensurePluginsRegistered(): void {
  if (pluginsRegistered) return
  pluginsRegistered = true

  // Dynamic import to avoid loading at module evaluation time
  import('../plugins').then(({ registerBuiltinPlugins }) => {
    registerBuiltinPlugins()
  })
}

/**
 * Synchronous version that registers plugins immediately.
 * Use this when you need plugins available right away.
 */
export async function ensurePluginsRegisteredSync(): Promise<void> {
  if (pluginsRegistered) return
  pluginsRegistered = true

  const { registerBuiltinPlugins } = await import('../plugins')
  registerBuiltinPlugins()
}
