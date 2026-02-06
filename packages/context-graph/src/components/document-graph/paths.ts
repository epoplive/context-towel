import type { ContextGraphTreeItemDTO } from '../../dto/contextGraphDTO'

export interface GraphRoot {
  id: string
  path: string
  baseName: string
}

export function normalizeRootPath(path: string): string {
  return path.replace(/\/\.\//g, '/').replace(/\/+$/, '')
}

export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/')
}

export function getBaseName(path: string): string {
  const trimmed = normalizeRootPath(path)
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] || trimmed || path
}

export function getParentDir(path: string): string {
  const normalized = normalizeFsPath(path).replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return normalized
  return normalized.slice(0, idx)
}

type TreeItem = ContextGraphTreeItemDTO

export function remapTreeItems(items: TreeItem[], root: GraphRoot): TreeItem[] {
  const prefix = `${root.baseName}/`
  const mapped = items.map((item) => {
    let relative = item.id
    if (relative === root.baseName) {
      relative = ''
    } else if (relative.startsWith(prefix)) {
      relative = relative.slice(prefix.length)
    }
    const id = relative ? `${root.id}/${relative}` : root.id
    return { ...item, id }
  })
  if (!mapped.some((item) => item.id === root.id)) {
    mapped.unshift({
      id: root.id,
      name: root.baseName,
      path: root.path,
      is_dir: true,
    })
  }
  return mapped
}

