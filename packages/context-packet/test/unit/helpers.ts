import type { FileService } from '../../src/types'

/**
 * In-memory FileService for testing.
 */
export function createMockFs(): FileService {
  const files = new Map<string, string>()
  const dirs = new Set<string>()

  return {
    async read(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) throw new Error(`File not found: ${path}`)
      return content
    },
    async write(path: string, content: string): Promise<void> {
      files.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return files.has(path) || dirs.has(path)
    },
    async mkdir(dirPath: string): Promise<void> {
      // Create all intermediate directories (like mkdir -p)
      const parts = dirPath.split('/')
      for (let i = 1; i <= parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    },
    async list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]> {
      const entries: { name: string; path: string; is_dir: boolean }[] = []
      const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/'

      // Find files directly in this directory
      for (const path of files.keys()) {
        if (path.startsWith(prefix)) {
          const rest = path.slice(prefix.length)
          if (!rest.includes('/')) {
            entries.push({ name: rest, path, is_dir: false })
          }
        }
      }

      // Find subdirectories
      for (const dir of dirs) {
        if (dir.startsWith(prefix)) {
          const rest = dir.slice(prefix.length)
          if (!rest.includes('/')) {
            entries.push({ name: rest, path: dir, is_dir: true })
          }
        }
      }

      return entries
    },
    async remove(filePath: string): Promise<void> {
      files.delete(filePath)
      dirs.delete(filePath)
    },
  }
}
