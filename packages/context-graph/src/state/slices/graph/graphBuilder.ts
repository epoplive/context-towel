// ============================================================================
// Context Graph State - Graph Builder (extracted from graphSlice.ts)
// ============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { StoreState } from '../types'
import { getDocType, getFolderType, shouldDefaultToTreeWidget } from '../../layoutUtils'

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function stripLinkSuffix(value: string): string {
  const withoutQuery = value.split('?')[0] ?? value
  return withoutQuery.split('#')[0] ?? withoutQuery
}

function isMarkdownDoc(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.markdown') || normalized.endsWith('.mdx')
}

function resolvePathSegments(path: string): string {
  const normalized = normalizePath(path)
  const leadingSlash = normalized.startsWith('/') ? '/' : ''
  const segments = normalized.split('/').filter(Boolean)
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '.') continue
    if (segment === '..') {
      resolved.pop()
      continue
    }
    resolved.push(segment)
  }
  return `${leadingSlash}${resolved.join('/')}`
}

function joinPath(base: string, relative: string): string {
  const baseNormalized = normalizePath(base).replace(/\/+$/, '')
  const relNormalized = normalizePath(relative)
  if (!relNormalized || relNormalized === '.') return baseNormalized
  if (relNormalized.startsWith('/')) return resolvePathSegments(relNormalized)
  return resolvePathSegments(`${baseNormalized}/${relNormalized}`)
}

function getDirectory(path: string): string {
  const normalized = normalizePath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return normalized
  return normalized.slice(0, idx)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

export function getViewKey(projectPath: string | null, focusedNode: string | null): string {
  const projectKey = projectPath ? projectPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-50) : 'default'
  return `${projectKey}::${focusedNode ?? '__main__'}`
}

// ----------------------------------------------------------------------------
// Graph Building
// ----------------------------------------------------------------------------

export function buildGraphFromState(state: StoreState): { nodes: Node[]; edges: Edge[] } {
  const {
    treeItems,
    docContents,
    projectPath,
    projectSettings,
    focusedNode,
    customFocusNodes,
    selectedNodes,
    collapsedFolders,
    treeWidgetFolders,
    cardScale,
  } = state

  const treeItemIds = new Set(treeItems.map(item => item.id))
  const rootIds = new Set<string>()

  treeItems.forEach(item => {
    if (!item.is_dir) return
    const parts = item.id.split('/')
    let hasParent = false
    for (let i = 1; i < parts.length; i++) {
      const parentId = parts.slice(0, i).join('/')
      if (treeItemIds.has(parentId)) {
        hasParent = true
        break
      }
    }
    if (!hasParent) {
      rootIds.add(item.id)
    }
  })

  // Link resolution helpers
  const normalizedProjectPath = projectPath ? normalizePath(projectPath).replace(/\/+$/, '') : ''
  const pathById = new Map<string, string>()
  const idByPath = new Map<string, string>()
  treeItems.forEach(item => {
    const normalized = normalizePath(item.path)
    pathById.set(item.id, normalized)
    idByPath.set(normalized, item.id)
  })

  const internalRoots = Array.from(rootIds)
    .map(rootId => {
      const rootPath = pathById.get(rootId)
      return rootPath ? normalizePath(rootPath).replace(/\/+$/, '') : ''
    })
    .filter(Boolean)

  const isInsideInternalRoot = (path: string): boolean => {
    if (!path) return false
    return internalRoots.some(root => path === root || path.startsWith(`${root}/`))
  }

  const resolveLinkTarget = (link: { kind: string; target: string; sourceFile: string }) => {
    const cleanedTarget = stripLinkSuffix(link.target)
    if (!cleanedTarget) return null

    const sourcePath = pathById.get(link.sourceFile) ?? link.sourceFile
    const sourceDir = sourcePath ? getDirectory(sourcePath) : ''

    if (link.kind === 'markdown') {
      if (cleanedTarget.startsWith('/')) {
        if (!normalizedProjectPath) return null
        return joinPath(normalizedProjectPath, cleanedTarget.replace(/^\/+/, ''))
      }
      if (sourceDir) {
        return joinPath(sourceDir, cleanedTarget)
      }
      if (!normalizedProjectPath) return null
      return joinPath(normalizedProjectPath, cleanedTarget)
    }

    // wiki links resolve from project root
    if (!normalizedProjectPath) return null
    const basePath = joinPath(normalizedProjectPath, cleanedTarget)
    if (isMarkdownDoc(basePath)) return basePath

    const candidates = [
      `${basePath}.md`,
      `${basePath}.markdown`,
      `${basePath}.mdx`,
    ]
    for (const candidate of candidates) {
      if (idByPath.has(candidate)) return candidate
    }
    return candidates[0]
  }

  const shouldShowTreeWidget = (folderId: string, folderType: ReturnType<typeof getFolderType>, isInFocusPath: boolean): boolean => {
    if (folderType === 'core' || isInFocusPath) return false
    const isDefaultTreeWidget = shouldDefaultToTreeWidget(folderType)
    const isToggled = treeWidgetFolders.has(folderId)
    return isToggled ? !isDefaultTreeWidget : isDefaultTreeWidget
  }

  const getRelativeDepth = (nodeId: string): number | null => {
    let bestRoot: string | null = null
    rootIds.forEach(rootId => {
      if (nodeId === rootId || nodeId.startsWith(rootId + '/')) {
        if (!bestRoot || rootId.length > bestRoot.length) {
          bestRoot = rootId
        }
      }
    })
    const rootLength = (bestRoot ?? '').length
    if (!bestRoot) return null
    if (nodeId === bestRoot) return 0
    const remainder = nodeId.slice(rootLength + 1)
    if (!remainder) return 0
    return remainder.split('/').filter(Boolean).length
  }

  // Build focus filter set
  const focusVisibleNodes = new Set<string>()
  const inFocusMode = Boolean(focusedNode || (customFocusNodes && customFocusNodes.length > 0))

  const getDetailLevel = (nodeId: string): 'full' | 'summary' | 'title' => {
    if (inFocusMode) return 'full'
    const relativeDepth = getRelativeDepth(nodeId)
    const depth = relativeDepth ?? Math.max(0, nodeId.split('/').length - 1)
    if (depth >= 3) return 'title'
    if (depth >= 2) return 'summary'
    return 'full'
  }

  if (customFocusNodes && customFocusNodes.length > 0) {
    focusVisibleNodes.add('CLAUDE.md')
    customFocusNodes.forEach(nodeId => {
      focusVisibleNodes.add(nodeId)
      const parts = nodeId.split('/')
      for (let i = 1; i <= parts.length; i++) {
        focusVisibleNodes.add(parts.slice(0, i).join('/'))
      }
    })
  } else if (focusedNode) {
    focusVisibleNodes.add('CLAUDE.md')
    focusVisibleNodes.add(focusedNode)

    const parts = focusedNode.split('/')
    for (let i = 1; i <= parts.length; i++) {
      focusVisibleNodes.add(parts.slice(0, i).join('/'))
    }

    treeItems.forEach(item => {
      if (item.id.startsWith(focusedNode + '/')) {
        focusVisibleNodes.add(item.id)
      }
    })
  }

  // Build hidden set
  const hiddenNodes = new Set<string>()
  function hideDescendants(folderId: string) {
    treeItems.forEach(item => {
      if (item.id.startsWith(folderId + '/')) {
        if (!focusVisibleNodes.has(item.id)) {
          hiddenNodes.add(item.id)
        }
      }
    })
  }

  // Hide descendants of collapsed folders
  collapsedFolders.forEach(id => hideDescendants(id))

  // Hide descendants of folders rendered as tree widgets
  treeItems.forEach(item => {
    if (!item.is_dir) return
    const folderType = getFolderType(item.id, projectSettings)
    const isInFocusPath = focusedNode && (focusedNode === item.id || focusedNode.startsWith(item.id + '/'))
    if (shouldShowTreeWidget(item.id, folderType, Boolean(isInFocusPath))) {
      hideDescendants(item.id)
    }
  })

  // Build nodes
  const flowNodes: Node[] = []

  // Add CLAUDE.md
  const claudeContent = docContents.get('CLAUDE.md')
  flowNodes.push({
    id: 'CLAUDE.md',
    type: 'document',
    position: { x: 0, y: 0 },
    data: {
      label: 'CLAUDE',
      path: 'CLAUDE.md',
      type: 'core',
      tasks: claudeContent?.tasks || [],
      sections: claudeContent?.sections || [],
      checklists: claudeContent?.checklists || [],
      loaded: !!claudeContent,
      isFocused: focusedNode === 'CLAUDE.md',
      detailLevel: 'full',
    },
  })

  // Add tree items as nodes
  treeItems.forEach(item => {
    if (hiddenNodes.has(item.id)) return
    if ((focusedNode || customFocusNodes) && !focusVisibleNodes.has(item.id)) return

    const docContent = docContents.get(item.id)

    if (item.is_dir) {
      const folderType = getFolderType(item.id, projectSettings)
      const isInFocusPath = focusedNode && (focusedNode === item.id || focusedNode.startsWith(item.id + '/'))
      const shouldShowAsTreeWidget = shouldShowTreeWidget(item.id, folderType, Boolean(isInFocusPath))

      if (shouldShowAsTreeWidget) {
        const descendants = treeItems.filter(t => t.id.startsWith(item.id + '/'))
        flowNodes.push({
          id: item.id,
          type: 'filetree',
          position: { x: 0, y: 0 },
          data: {
            label: item.name,
            folderId: item.id,
            basePath: item.path,
            items: descendants,
            cardScale,
          },
        })
      } else {
        const childCount = treeItems.filter(t =>
          t.id.startsWith(item.id + '/') &&
          t.id.split('/').length === item.id.split('/').length + 1
        ).length

        flowNodes.push({
          id: item.id,
          type: 'folder',
          position: { x: 0, y: 0 },
          data: {
            label: item.name,
            childCount,
            type: getFolderType(item.id, projectSettings),
            isExpanded: !collapsedFolders.has(item.id),
          },
        })
      }
    } else {
      const docType = getDocType(item.id, projectSettings)
      flowNodes.push({
        id: item.id,
        type: 'document',
        position: { x: 0, y: 0 },
        data: {
          label: item.name.replace('.md', ''),
          path: item.path,
          type: docType,
          tasks: docContent?.tasks || [],
          sections: docContent?.sections || [],
          checklists: docContent?.checklists || [],
          loaded: !!docContent,
          isFocused: focusedNode === item.id,
          detailLevel: getDetailLevel(item.id),
        },
      })

      // Add breakout nodes for focused document
      if (focusedNode === item.id && docContent) {
        // TOC node
        if (docContent.sections && docContent.sections.length > 0) {
          const tocSections: { title: string; level: number; sectionIndex: number; tasks?: number; tasksCompleted?: number }[] = []
          let sectionIdx = 0

          const flattenSections = (sections: typeof docContent.sections): void => {
            sections.forEach((section) => {
              if (section.level <= 2) {
                tocSections.push({
                  title: section.title,
                  level: section.level,
                  sectionIndex: sectionIdx++,
                  tasks: section.counts?.tasks,
                  tasksCompleted: section.counts?.tasksCompleted,
                })
              }
              if (section.children.length > 0) {
                flattenSections(section.children)
              }
            })
          }
          flattenSections(docContent.sections)

          if (tocSections.length > 0) {
            flowNodes.push({
              id: `${item.id}#toc`,
              type: 'toc',
              position: { x: 0, y: 0 },
              data: {
                parentDocId: item.id,
                docName: item.name,
                sections: tocSections,
              },
            })
          }
        }

        // Task list nodes - grouped by section
        if (docContent.tasks && docContent.tasks.length > 0) {
          // Build flat list of sections with line ranges for task matching
          interface SectionRange {
            title: string
            id: string
            startLine: number
            endLine: number
          }
          const sectionRanges: SectionRange[] = []

          const collectSectionRanges = (sections: typeof docContent.sections): void => {
            sections.forEach((section) => {
              if (section.sourceLine !== undefined && section.sourceEndLine !== undefined) {
                sectionRanges.push({
                  title: section.title,
                  id: section.id,
                  startLine: section.sourceLine,
                  endLine: section.sourceEndLine,
                })
              }
              if (section.children.length > 0) {
                collectSectionRanges(section.children)
              }
            })
          }
          if (docContent.sections) {
            collectSectionRanges(docContent.sections)
          }

          // Group tasks by section
          const tasksBySection = new Map<string, typeof docContent.tasks>()
          const ungroupedTasks: typeof docContent.tasks = []

          docContent.tasks.forEach((task) => {
            const taskLine = task.sourceLine || 0
            // Find the most specific (deepest) section that contains this task
            let matchedSection: SectionRange | null = null
            for (const section of sectionRanges) {
              if (taskLine >= section.startLine && taskLine <= section.endLine) {
                if (!matchedSection || section.startLine > matchedSection.startLine) {
                  matchedSection = section
                }
              }
            }

            if (matchedSection) {
              const existing = tasksBySection.get(matchedSection.id) || []
              existing.push(task)
              tasksBySection.set(matchedSection.id, existing)
            } else {
              ungroupedTasks.push(task)
            }
          })

          // Create a TaskListNode for each section that has tasks
          tasksBySection.forEach((tasks, sectionId) => {
            const section = sectionRanges.find(s => s.id === sectionId)
            flowNodes.push({
              id: `${item.id}#tasklist-${sectionId}`,
              type: 'tasklist',
              position: { x: 0, y: 0 },
              data: {
                tasks,
                parentDocId: item.id,
                sectionTitle: section?.title,
              },
            })
          })

          // Create a TaskListNode for ungrouped tasks if any
          if (ungroupedTasks.length > 0) {
            flowNodes.push({
              id: `${item.id}#tasklist-ungrouped`,
              type: 'tasklist',
              position: { x: 0, y: 0 },
              data: {
                tasks: ungroupedTasks,
                parentDocId: item.id,
                sectionTitle: 'Other Tasks',
              },
            })
          }
        }

        // Checklist nodes
        if (docContent.checklists && docContent.checklists.length > 0) {
          docContent.checklists.forEach((group, idx) => {
            flowNodes.push({
              id: `${item.id}#checklist-${idx}`,
              type: 'checklist',
              position: { x: 0, y: 0 },
              data: {
                group,
                parentDocId: item.id,
              },
            })
          })
        }

        // Diagram nodes
        if (docContent.diagrams && docContent.diagrams.length > 0) {
          docContent.diagrams.forEach((diagram) => {
            flowNodes.push({
              id: `${item.id}#diagram-${diagram.id}`,
              type: 'diagram',
              position: { x: 0, y: 0 },
              data: {
                diagram,
                parentDocId: item.id,
              },
            })
          })
        }
      }

      if (docContent?.links && docContent.links.length > 0) {
        const shouldShowLinks = Boolean(
          focusedNode === item.id ||
          selectedNodes.includes(item.id) ||
          (customFocusNodes && customFocusNodes.includes(item.id))
        )
        if (shouldShowLinks) {
          const seen = new Set<string>()
          const linkItems = docContent.links.flatMap((link) => {
            const key = `${link.kind}:${link.target}:${link.text ?? ''}`
            if (seen.has(key)) return []
            seen.add(key)

            const cleanedTarget = stripLinkSuffix(link.target)
            if (!cleanedTarget) return []
            const resolvedTarget = resolveLinkTarget({
              kind: link.kind,
              target: cleanedTarget,
              sourceFile: link.sourceFile || item.id,
            })
            const normalizedTarget = resolvedTarget ? normalizePath(resolvedTarget) : null
            const targetId = normalizedTarget ? idByPath.get(normalizedTarget) : undefined
            const insideRoot = normalizedTarget ? isInsideInternalRoot(normalizedTarget) : false
            const status = targetId
              ? 'internal'
              : normalizedTarget
                ? (insideRoot ? 'missing' : 'external')
                : 'unresolved'

            return [{
              id: link.id,
              label: link.text || cleanedTarget,
              target: cleanedTarget,
              status,
              targetPath: normalizedTarget ?? undefined,
              targetId,
              sourceLine: link.sourceLine,
            }]
          })

          if (linkItems.length > 0) {
            flowNodes.push({
              id: `${item.id}#links`,
              type: 'link-card',
              position: { x: 0, y: 0 },
              data: {
                parentDocId: item.id,
                docName: item.name,
                links: linkItems,
              },
            })
          }
        }
      }
    }
  })

  // Build edges
  const nodeIds = new Set(flowNodes.map(n => n.id))

  const structuralEdges: Edge[] = []
  const breakoutTypes = new Set(['toc', 'tasklist', 'checklist', 'diagram', 'link-card'])

  flowNodes.forEach(node => {
    if (node.id === 'CLAUDE.md') return

    // Breakout nodes get edges from their parentDocId
    if (breakoutTypes.has(node.type || '') && node.data?.parentDocId) {
      const parentDocId = node.data.parentDocId as string
      const edgeColor = node.type === 'toc' ? '#4fc3f7' :
                        node.type === 'tasklist' ? '#3b82f6' :
                        node.type === 'diagram' ? '#22c55e' :
                        node.type === 'link-card' ? '#f59e0b' :
                        '#a855f7'
      structuralEdges.push({
        id: `${parentDocId}->${node.id}`,
        source: parentDocId,
        target: node.id,
        type: 'floating',
        style: { stroke: edgeColor, strokeWidth: 1.5 },
        data: { edgeType: 'structural' },
      })
      return
    }

    // Regular nodes get edges based on path hierarchy
    let parentId: string
    if (rootIds.has(node.id)) {
      parentId = 'CLAUDE.md'
    } else {
      const parts = node.id.split('/')
      parentId = 'CLAUDE.md'

      for (let i = parts.length - 1; i >= 1; i--) {
        const candidateParent = parts.slice(0, i).join('/')
        if (nodeIds.has(candidateParent)) {
          parentId = candidateParent
          break
        }
      }
    }

    structuralEdges.push({
      id: `${parentId}->${node.id}`,
      source: parentId,
      target: node.id,
      type: 'floating',
      style: { stroke: '#ffd54f', strokeWidth: 2 },
      data: { edgeType: 'structural' },
    })
  })

  const linkEdges: Edge[] = []

  docContents.forEach((docContent, docId) => {
    const links = docContent.links ?? []
    if (links.length === 0) return
    if (!nodeIds.has(docId)) return

    links.forEach(link => {
      const sourceId = docId
      const resolvedTarget = resolveLinkTarget({
        kind: link.kind,
        target: link.target,
        sourceFile: link.sourceFile || docId,
      })
      if (!resolvedTarget) return
      const normalizedTarget = normalizePath(resolvedTarget)
      const targetId = idByPath.get(normalizedTarget)

      if (targetId && nodeIds.has(targetId)) {
        linkEdges.push({
          id: `${sourceId}=>${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'floating',
          style: { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 4' },
          data: { edgeType: 'link' },
        })
      }
    })
  })

  return { nodes: flowNodes, edges: [...structuralEdges, ...linkEdges] }
}
