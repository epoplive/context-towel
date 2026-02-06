// Window-scoped storage — simplified compat for standalone use
// In LG this scopes localStorage by Tauri window label; here we just use localStorage directly

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type StorageProvider = () => StorageLike

let provider: StorageProvider | null = null

/**
 * Configure a host-provided window-scoped storage implementation.
 * Looking Glass uses this to scope localStorage keys by Tauri window label.
 */
export function configureWindowScopedStorage(next: StorageProvider): void {
  provider = next
}

export function resetWindowScopedStorage(): void {
  provider = null
}

export const getWindowScopedStorage = (_windowId?: string): StorageLike => {
  if (provider) return provider()

  const storage = (globalThis as unknown as { localStorage?: StorageLike }).localStorage
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  ) {
    return storage
  }
  // SSR / test fallback
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}
