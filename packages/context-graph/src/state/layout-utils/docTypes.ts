import {
  ProjectSettings,
  matchesFolderId,
  normalizeProjectSettings,
} from '../../compat/project-settings'

/**
 * Get document type from path
 */
export type DocType = 'core' | 'research' | 'spike' | 'other'

/**
 * Get folder type from path
 */
export type FolderType = 'core' | 'research' | 'archive' | 'other'

function getPrefixedFolderType(path: string): FolderType | null {
  if (path.startsWith('core@')) return 'core'
  if (path.startsWith('research@')) return 'research'
  if (path.startsWith('archive@')) return 'archive'
  return null
}

function getPrefixedDocType(path: string): DocType | null {
  const folderType = getPrefixedFolderType(path)
  if (!folderType) return null
  if (folderType === 'archive') return 'spike'
  return folderType
}

export function getDocType(path: string, settings?: ProjectSettings): DocType {
  const prefixed = getPrefixedDocType(path)
  if (prefixed) return prefixed
  const resolved = normalizeProjectSettings(settings)

  if (matchesFolderId(path, resolved.folders.working)) return 'core'
  if (matchesFolderId(path, resolved.folders.docs)) return 'research'
  if (matchesFolderId(path, resolved.folders.archive)) return 'spike'
  if (['CLAUDE.md', 'plan.md', 'architecture.md', 'current-focus.md', 'decisions.md'].some(f => path.endsWith(f))) {
    return 'core'
  }
  return 'other'
}

export function getFolderType(path: string, settings?: ProjectSettings): FolderType {
  const prefixed = getPrefixedFolderType(path)
  if (prefixed) return prefixed
  const resolved = normalizeProjectSettings(settings)

  if (matchesFolderId(path, resolved.folders.working)) return 'core'
  if (matchesFolderId(path, resolved.folders.docs)) return 'research'
  if (matchesFolderId(path, resolved.folders.archive)) return 'archive'
  return 'other'
}

/**
 * Check if a folder type should show as a collapsed tree widget by default
 * Per CLAUDE.md: archive shows as FileTreeNode, docs is utility folder
 * Only working folder ('core') expands to show full nodes
 */
export function shouldDefaultToTreeWidget(folderType: FolderType): boolean {
  return folderType === 'archive' || folderType === 'research'
}

