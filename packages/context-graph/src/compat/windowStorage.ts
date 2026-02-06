// Window-scoped storage — simplified compat for standalone use
// In LG this scopes localStorage by Tauri window label; here we just use localStorage directly

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const getWindowScopedStorage = (_windowId?: string): StorageLike => {
  if (typeof localStorage !== 'undefined') return localStorage
  // SSR / test fallback
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}
