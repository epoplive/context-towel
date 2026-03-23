/**
 * File service that uses Tauri plugin-fs to read/watch project files.
 * This is the bridge between the filesystem and the context graph store.
 */

import {
  exists,
  readTextFile,
  writeTextFile,
  readDir,
  watch,
  stat,
  type DirEntry,
} from '@tauri-apps/plugin-fs'

export interface TreeItem {
  id: string
  name: string
  path: string
  is_dir: boolean
}

export interface GraphRoot {
  id: string
  path: string
  baseName: string
}

/**
 * Recursively walk a directory and return flat TreeItem list
 */
export async function walkProjectTree(projectPath: string): Promise<TreeItem[]> {
  const items: TreeItem[] = []

  async function recurse(dirPath: string) {
    let entries: DirEntry[]
    try {
      entries = await readDir(dirPath)
    } catch {
      return
    }

    // Sort: dirs first, then alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      // Skip hidden files except .context
      if (entry.name.startsWith('.') && entry.name !== '.context') continue
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue

      const fullPath = `${dirPath}/${entry.name}`
      const relativePath = fullPath.slice(projectPath.length + 1)
      const isDir = entry.isDirectory ?? false

      items.push({
        id: relativePath,
        name: entry.name,
        path: fullPath,
        is_dir: isDir,
      })

      if (isDir) {
        await recurse(fullPath)
      }
    }
  }

  await recurse(projectPath)
  return items
}

/**
 * Read content of all markdown files from a tree item list
 */
export async function readAllMarkdownFiles(
  items: TreeItem[]
): Promise<Array<{ id: string; content: string }>> {
  const mdFiles = items.filter(
    (item) => !item.is_dir && item.name.endsWith('.md')
  )

  const results = await Promise.all(
    mdFiles.map(async (file) => {
      try {
        const content = await readTextFile(file.path)
        return { id: file.id, content }
      } catch {
        console.warn(`Failed to read ${file.path}`)
        return null
      }
    })
  )

  return results.filter((r): r is { id: string; content: string } => r !== null)
}

/**
 * Detect graph roots from a project path.
 * Looks for .context directory first, falls back to the project root.
 */
export async function detectGraphRoots(projectPath: string): Promise<GraphRoot[]> {
  const contextPath = `${projectPath}/.context`
  const hasContext = await exists(contextPath)

  if (hasContext) {
    return [{ id: '.context', path: contextPath, baseName: '.context' }]
  }

  // Fallback: use the project directory itself
  const name = projectPath.split('/').pop() || 'project'
  return [{ id: name, path: projectPath, baseName: name }]
}

/**
 * Read a single file's content
 */
export async function readFileContent(path: string): Promise<string | null> {
  try {
    return await readTextFile(path)
  } catch {
    return null
  }
}

/**
 * Write content to a file
 */
export async function writeFileContent(path: string, content: string): Promise<boolean> {
  try {
    await writeTextFile(path, content)
    return true
  } catch (err) {
    console.error(`Failed to write ${path}:`, err)
    return false
  }
}

/**
 * Watch a directory for changes. Returns an unwatch function.
 */
export async function watchProject(
  projectPath: string,
  onChange: (paths: string[]) => void
): Promise<() => void> {
  const unwatch = await watch(projectPath, (event) => {
    // event.paths contains the changed file paths
    if (event.paths && event.paths.length > 0) {
      onChange(event.paths.map(String))
    }
  }, { recursive: true })

  return () => { unwatch() }
}

/**
 * Watch a single file for changes. Returns an unwatch function.
 * Unlike watchProject, this does NOT watch recursively — safe for files
 * in parent directories that might be large monorepos.
 */
export async function watchFile(
  filePath: string,
  onChange: () => void
): Promise<() => void> {
  const unwatch = await watch(filePath, (event) => {
    if (event.paths && event.paths.length > 0) {
      onChange()
    }
  })

  return () => { unwatch() }
}

/**
 * Get file stats (for checking if file exists and its modification time)
 */
export async function getFileStat(path: string) {
  try {
    const s = await stat(path)
    return { exists: true, isDir: s.isDirectory, size: s.size, mtime: s.mtime }
  } catch {
    return { exists: false, isDir: false, size: 0, mtime: null }
  }
}
