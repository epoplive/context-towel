export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export class HomeDirResolver {
  private homeDir: string | null | undefined
  private homeDirPromise: Promise<string | null> | null = null

  resolveSync(): string | null {
    if (this.homeDir !== undefined) {
      return this.homeDir
    }
    if (typeof process !== 'undefined' && process.env.HOME) {
      this.homeDir = process.env.HOME
      return this.homeDir
    }
    return null
  }

  async resolve(): Promise<string | null> {
    if (this.homeDir !== undefined) {
      return this.homeDir
    }
    if (this.homeDirPromise) {
      return this.homeDirPromise
    }

    this.homeDirPromise = (async () => {
      try {
        const { homeDir } = await import('@tauri-apps/api/path')
        const resolved = await homeDir()
        return resolved || null
      } catch {
        if (typeof process !== 'undefined' && process.env.HOME) {
          return process.env.HOME
        }
        return null
      }
    })()

    const resolvedHome = await this.homeDirPromise
    this.homeDir = resolvedHome
    this.homeDirPromise = null
    return resolvedHome
  }

  async resolvePath(path: string): Promise<string> {
    const normalized = normalizePath(path)
    if (!normalized.startsWith('~')) {
      return normalized
    }

    const home = await this.resolve()
    if (!home) {
      return normalized
    }

    const normalizedHome = normalizePath(home)
    return normalizePath(normalized.replace(/^~(?=\/|\\|$)/, normalizedHome))
  }

  resolvePathSync(path: string): string {
    const normalized = normalizePath(path)
    if (!normalized.startsWith('~')) {
      return normalized
    }

    const home = this.resolveSync()
    if (!home) {
      return normalized
    }

    const normalizedHome = normalizePath(home)
    return normalizePath(normalized.replace(/^~(?=\/|\\|$)/, normalizedHome))
  }
}

/**
 * Ensure the parent directory for a file exists.
 * Takes a mkdir callback so the platform-specific mkdir implementation can be injected.
 */
export async function ensureDirectoryForFile(
  path: string,
  mkdirFn: (dir: string) => Promise<void>
): Promise<void> {
  const normalized = normalizePath(path)
  const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  if (lastSlash <= 0) return
  const parent = normalized.slice(0, lastSlash)
  if (!parent || parent === normalized) return
  await mkdirFn(parent)
}
