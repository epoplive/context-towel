import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionMode,
  OnSelectionChangeFunc,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useContextGraphController } from '../hooks/useContextGraphController'
import { useGraphStore } from '../state/store'
import { useGraphShortcuts, scopeManager } from '../compat/keybindings'
import { FullscreenModal, FullscreenModalState } from '../legacy/markdown'
import { WidgetMarkdownRenderer } from '../legacy/widgets/WidgetMarkdownRenderer'
import { nodeTypes, edgeTypes } from './FlowNodes'
import { GraphControlPanel } from './document-graph/GraphControlPanel'
import { FocusBreadcrumbs } from './document-graph/panels/FocusBreadcrumbs'
import { SelectionPanel } from './document-graph/panels/SelectionPanel'
import {
  getBaseName,
  getParentDir,
  normalizeFsPath,
  normalizeRootPath,
  remapTreeItems,
  type GraphRoot,
} from './document-graph/paths'
import type { TaskItem } from '../plugins'
import type { TreeItem } from '../types'
import { useTheme, Icon, icons, useMermaidTheme } from '../compat/design-system'
import { useWindowVisibility } from '../compat/useWindowVisibility'
import { layoutPrimitives } from '../compat/layoutPrimitives'
import {
  ProjectSettings,
  getContextFolderPath,
  getWorkspaceFolderId,
  matchesFolderId,
  normalizeProjectSettings,
} from '../compat/project-settings'
import { getDocType, getFolderType } from '../state/layoutUtils'

type ParsedTask = TaskItem

export interface DocumentGraphProps {
  projectPath?: string
  projectSettings?: ProjectSettings
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  activeProblem?: string | null
  onSelectProblem?: (problemFilePath: string) => void
  graphRoots?: GraphRoot[]
  scopeId?: string
  isVisible?: boolean
}

export type { GraphRoot } from './document-graph/paths'

// Import additional types for sections
// Import from /types directly to avoid circular dependency through plugin components
import type { TocSection } from '../plugins/toc/types'
import type { ChecklistGroup } from '../plugins/checklist/types'
import type { DiagramItem } from '../plugins/diagram/types'

// Note: Mermaid is initialized via useMermaidTheme hook in DocumentGraph component
// This ensures theme reactivity when user changes theme

// Smart slide - simplified, just title + content
  // WidgetMarkdownRenderer handles widget tags + legacy task blocks; MarkdownRenderer handles pure markdown/diagrams.
interface SmartSlide {
  title: string
  level: number
  content: string
}

// Size threshold for splitting (characters)
const MAX_SLIDE_SIZE = 4000

// Build slides from TOC sections
// Logic:
// 1. Each section combines with all its children by default
// 2. Only split if content exceeds MAX_SLIDE_SIZE
// 3. Split at natural break points (between task blocks, at sub-headings)
function buildSmartSlides(
  sections: TocSection[],
  _tasks: TaskItem[],        // Unused - MarkdownRenderer handles ```task blocks
  _checklists: ChecklistGroup[], // Unused - MarkdownRenderer handles checklists
  _diagrams: DiagramItem[],  // Unused - MarkdownRenderer handles ```mermaid
  rawContent: string
): SmartSlide[] {
  // Wrap everything in try-catch to prevent graph breaking
  try {
    // If no sections, split raw content
    if (!sections || sections.length === 0) {
      if (rawContent && rawContent.length > MAX_SLIDE_SIZE) {
        return splitContentIntoSlides('Document', 1, rawContent)
      }
      return [{ title: 'Document', level: 1, content: rawContent || '' }]
    }

  // Flatten all sections recursively
  const flattenSections = (secs: TocSection[]): TocSection[] => {
    const flat: TocSection[] = []
    for (const sec of secs) {
      flat.push(sec)
      if (sec.children && sec.children.length > 0) {
        flat.push(...flattenSections(sec.children))
      }
    }
    return flat
  }

  const allSections = flattenSections(sections)

  // Split large content into slides
  function splitContentIntoSlides(title: string, level: number, content: string): SmartSlide[] {
    const result: SmartSlide[] = []
    // Match ALL code blocks (``` with any language or none), not just task blocks
    // This prevents code blocks from being broken by paragraph splitting
    const codeBlockRegex = /```[\s\S]*?```/g
    const parts: { content: string; isCodeBlock: boolean; isTaskBlock: boolean }[] = []

    let lastIndex = 0
    let match
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ content: content.slice(lastIndex, match.index), isCodeBlock: false, isTaskBlock: false })
      }
      const isTask = match[0].startsWith('```task')
      parts.push({ content: match[0], isCodeBlock: true, isTaskBlock: isTask })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push({ content: content.slice(lastIndex), isCodeBlock: false, isTaskBlock: false })
    }

    let currentSlide: string[] = []
    let currentSize = 0
    let slideIndex = 0
    let taskCount = 0

    const flushSlide = () => {
      if (currentSlide.length > 0) {
        const slideTitle = slideIndex === 0 ? title : `${title} (cont.)`
        result.push({ title: slideTitle, level, content: currentSlide.join('') })
        currentSlide = []
        currentSize = 0
        taskCount = 0
        slideIndex++
      }
    }

    for (const part of parts) {
      if (part.isCodeBlock) {
        // Keep code blocks intact - never split them
        if (part.isTaskBlock) {
          // Split after 5 tasks OR if exceeding size
          if ((taskCount >= 5 && currentSize > 2000) ||
              (currentSize > 0 && currentSize + part.content.length > MAX_SLIDE_SIZE)) {
            flushSlide()
          }
          taskCount++
        } else {
          // Regular code block - just check size
          if (currentSize > 0 && currentSize + part.content.length > MAX_SLIDE_SIZE) {
            flushSlide()
          }
        }
        currentSlide.push(part.content)
        currentSize += part.content.length
      } else {
        // Non-code content - safe to split by paragraphs
        const paragraphs = part.content.split(/\n\n+/)
        for (const para of paragraphs) {
          if (currentSize + para.length > MAX_SLIDE_SIZE && currentSize > 0) {
            flushSlide()
          }
          currentSlide.push(para + '\n\n')
          currentSize += para.length + 2
        }
      }
    }
    flushSlide()

    return result.length > 0 ? result : [{ title, level, content }]
  }

  // Build slides - combine small sections, split large ones
  const slides: SmartSlide[] = []
  const MIN_SLIDE_SIZE = 800 // Don't create slides smaller than this

  // Helper to create full markdown content with heading
  const makeHeading = (level: number, title: string) => '#'.repeat(level) + ' ' + title
  const sectionWithHeading = (sec: TocSection) => makeHeading(sec.level, sec.title) + '\n\n' + (sec.content || '')

  let pendingSection: { title: string; level: number; content: string } | null = null

  for (const section of allSections) {
    // Include the heading in content
    const fullContent = sectionWithHeading(section)
    // Only skip if truly empty (no content AND no heading worth showing)
    if (!section.content?.trim() && !section.title?.trim()) continue

    // Check if this is a "standalone" section (Notes, Summary, etc.)
    const isStandaloneSection = /^(notes|summary|conclusion|references|appendix)/i.test(section.title)

    if (isStandaloneSection && pendingSection) {
      // Flush pending before standalone section
      if (pendingSection.content.length > MAX_SLIDE_SIZE) {
        slides.push(...splitContentIntoSlides(pendingSection.title, pendingSection.level, pendingSection.content))
      } else {
        slides.push(pendingSection)
      }
      pendingSection = null
    }

    if (fullContent.length > MAX_SLIDE_SIZE) {
      // Large section - split it
      if (pendingSection) {
        slides.push(pendingSection)
        pendingSection = null
      }
      slides.push(...splitContentIntoSlides(section.title, section.level, fullContent))
    } else if (fullContent.length < MIN_SLIDE_SIZE && !isStandaloneSection && pendingSection) {
      // Small section - combine with pending (add full content with heading)
      pendingSection.content += '\n\n' + fullContent
      pendingSection.title = pendingSection.title.split(' & ')[0] + ' & more'
    } else if (fullContent.length < MIN_SLIDE_SIZE && !isStandaloneSection && !pendingSection) {
      // Start new pending
      pendingSection = { title: section.title, level: section.level, content: fullContent }
    } else {
      // Normal size - flush pending and add this
      if (pendingSection) {
        slides.push(pendingSection)
        pendingSection = null
      }
      slides.push({ title: section.title, level: section.level, content: fullContent })
    }
  }

  // Flush any remaining pending
  if (pendingSection) {
    if (pendingSection.content.length > MAX_SLIDE_SIZE) {
      slides.push(...splitContentIntoSlides(pendingSection.title, pendingSection.level, pendingSection.content))
    } else {
      slides.push(pendingSection)
    }
  }

  return slides.length > 0 ? slides : [{ title: 'Document', level: 1, content: rawContent || '' }]
  } catch (e) {
    console.error('buildSmartSlides error:', e)
    return [{ title: 'Document', level: 1, content: rawContent || '' }]
  }
}

// Full view - smart paginated slideshow
interface SectionViewProps {
  content: string
  typeColor: string
  sections?: TocSection[]
  onFullscreen?: (state: FullscreenModalState) => void
}

function SectionView({ content, typeColor, sections, onFullscreen }: SectionViewProps) {
  const { colors } = useTheme()
  const [currentPage, setCurrentPage] = useState(0)

  // Build slides - just pass sections and content, renderer handles task blocks
  const slides = useMemo(() => {
    try {
      return buildSmartSlides(sections || [], [], [], [], content)
    } catch (e) {
      console.error('buildSmartSlides error:', e)
      return [{ title: 'Document', level: 1, content: content || '' }]
    }
  }, [sections, content])

  const slide = slides[currentPage] || slides[0]
  const totalPages = slides.length

  const goNext = () => setCurrentPage(p => Math.min(p + 1, totalPages - 1))
  const goPrev = () => setCurrentPage(p => Math.max(p - 1, 0))

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [totalPages])

  if (!slide) return null

  return (
    <div style={{ ...layoutPrimitives.fillColumn, width: '100%', overflow: 'hidden' }}>
      {/* Header with title, level indicator, and pagination */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        background: colors.bgSecondary,
        borderRadius: '4px',
        marginBottom: '8px',
        flexShrink: 0,
      }}>
        {/* Level indicator */}
        <span style={{
          background: typeColor,
          color: colors.textInverse,
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 600,
          minWidth: '24px',
          textAlign: 'center',
        }}>
          H{slide.level}
        </span>
        <span style={{
          color: typeColor,
          fontWeight: 600,
          fontSize: '12px',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {slide.title}
        </span>
        {totalPages > 1 && (
          <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '4px' }}>
            <button
              onClick={goPrev}
              disabled={currentPage === 0}
              style={{
                background: currentPage === 0 ? colors.bgTertiary : colors.buttonBg,
                border: 'none',
                color: currentPage === 0 ? colors.textMuted : colors.textPrimary,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: currentPage === 0 ? 'default' : 'pointer',
                fontSize: '10px',
              }}
            >
              ◀
            </button>
            <span style={{ color: colors.textMuted, fontSize: '10px', minWidth: '40px', textAlign: 'center' }}>
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={goNext}
              disabled={currentPage === totalPages - 1}
              style={{
                background: currentPage === totalPages - 1 ? colors.bgTertiary : colors.buttonBg,
                border: 'none',
                color: currentPage === totalPages - 1 ? colors.textMuted : colors.textPrimary,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                fontSize: '10px',
              }}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Content area - renderer handles task blocks, diagrams, etc. */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px', minWidth: 0, width: '100%' }}>
        {slide.content && slide.content.trim() ? (
          <WidgetMarkdownRenderer content={slide.content} onFullscreen={onFullscreen} />
        ) : (
          <div style={{
            color: colors.textMuted,
            fontSize: '11px',
            fontStyle: 'italic',
            padding: '12px',
            textAlign: 'center',
          }}>
            This section has no content
          </div>
        )}
      </div>
    </div>
  )
}

// Quick preview popover component - shows task overview or content
interface QuickPreviewProps {
  name: string
  type: string
  isFile: boolean
  tasks?: ParsedTask[]
  content?: string
  sections?: TocSection[]
  checklists?: ChecklistGroup[]
  diagrams?: DiagramItem[]
  sourceFile?: string
  onClose: () => void
  onOpenFull?: () => void
  onEdit?: () => void
  onFullscreen?: (state: FullscreenModalState) => void
  onFocus?: () => void
  initialSectionIndex?: number
  position: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
}

function QuickPreview({ name, type, isFile, tasks: _tasks, content, sections, checklists: _checklists, diagrams: _diagrams, sourceFile: _sourceFile, onClose, onOpenFull, onEdit, onFocus, position, onPositionChange }: QuickPreviewProps) {
  const { colors, shadows } = useTheme()
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      onPositionChange({
        x: Math.max(0, dragRef.current.startPosX + dx),
        y: Math.max(0, dragRef.current.startPosY + dy),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const typeColor =
    type === 'core' ? colors.graphCore :
    type === 'research' ? colors.graphResearch :
    type === 'skill' ? colors.graphSkill :
    type === 'spike' ? colors.graphSpike :
    colors.graphFolder

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 100,
      }}
    >
      <div style={{
        background: colors.bgSecondary,
        border: `1px solid ${colors.borderSecondary}`,
        borderRadius: '6px',
        padding: '10px',
        width: '420px',
        height: '500px',
        minWidth: '300px',
        minHeight: '200px',
        maxWidth: '80vw',
        maxHeight: '80vh',
        boxShadow: shadows.lg,
        ...layoutPrimitives.column,
        resize: 'both',
        overflow: 'hidden',
      }}>
        {/* Header - draggable */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            ...layoutPrimitives.row,
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: typeColor,
          }} />
          <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '12px', flex: 1 }}>
            {name.replace('.md', '')}
          </span>
          <span style={{
            background: colors.buttonBg,
            color: colors.textSecondary,
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '9px',
            textTransform: 'uppercase',
          }}>
            {type}
          </span>
          <button
            onClick={onClose}
            style={{
              ...layoutPrimitives.row,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '0 2px',
            }}
          >
            <Icon icon={icons.close} size="xs" />
          </button>
        </div>

        {/* Content - same as full view, just in preview container */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: colors.bgPrimary,
          borderRadius: '4px',
          padding: '8px',
          marginBottom: '8px',
          minWidth: 0,
          width: '100%',
        }}>
          <SectionView
            content={content || ''}
            typeColor={typeColor}
            sections={sections}
          />
        </div>

        {/* Actions */}
        <div style={{ ...layoutPrimitives.row, gap: '6px' }}>
          {isFile && onOpenFull && (
            <button
              onClick={onOpenFull}
              style={{
                flex: 1,
                background: colors.accent,
                border: 'none',
                color: colors.textInverse,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Open Full View
            </button>
          )}
          {onFocus && (
            <button
              onClick={onFocus}
              style={{
                background: colors.success,
                border: 'none',
                color: colors.textInverse,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title="Focus on this node and its descendants"
            >
              Focus
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              style={{
                background: colors.buttonBg,
                border: `1px solid ${colors.borderSecondary}`,
                color: colors.textSecondary,
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function DocumentGraph({
  projectPath,
  projectSettings,
  onOpenFile,
  graphRoots: providedGraphRoots,
  scopeId,
  isVisible = true,
}: DocumentGraphProps) {
  const { colors, shadows } = useTheme()
  const controller = useContextGraphController()
  const { isHidden } = useWindowVisibility()
  const isActive = isVisible && !isHidden

  // Initialize mermaid with current theme (re-initializes on theme change)
  useMermaidTheme()

  // Store state
  const {
    treeItems,
    docContents,
    selectedNodes,
    expandedPanel,
    quickPreviewNode,
    focusedNode,
    customFocusNodes,
    collapsedFolders,
    pinnedNodes,
    lockedNodes,
    cardScale,
    contextMenu,
    nodes: storeNodes,
    edges: storeEdges,
    setProjectPath,
    setTreeItems,
    setDocContentParsed,
    setProjectSettings,
    closeNode,
    setExpandedPanel,
    toggleFolderCollapse,
    toggleTreeWidget,
    rebuildGraph,
    setQuickPreviewNode,
    openFullView,
    setFocusedNode,
    getFocusBreadcrumbs,
    updateNodePosition,
    increaseCardScale,
    decreaseCardScale,
    setViewportDimensions,
    showContextMenu,
    closeContextMenu,
    previewPanelPosition,
    setPreviewPanelPosition,
    clearViewLayout,
    setMeasuredDimensions,
    togglePinnedNode,
    toggleLockedNode,
    setPinnedNodes,
    setLockedNodes,
  } = useGraphStore()

  const resolvedSettings = useMemo(() => normalizeProjectSettings(projectSettings), [projectSettings])
  const [externalRoots, setExternalRoots] = useState<GraphRoot[]>([])
  const [pendingLinkOpen, setPendingLinkOpen] = useState<{ path: string; action: 'panel' | 'preview' } | null>(null)
  const baseFolders = useMemo(() => ([
    resolvedSettings.folders.working,
    resolvedSettings.folders.docs,
    resolvedSettings.folders.archive,
  ] as const).map(folder => folder?.trim()).filter((value): value is string => Boolean(value)), [resolvedSettings])
  const computedGraphRoots = useMemo<GraphRoot[]>(() => {
    if (!projectPath) return []
    const roots = new Map<string, GraphRoot>()

    const addRootEntry = (id: string, path: string) => {
      const normalizedPath = normalizeRootPath(path)
      if (!normalizedPath || roots.has(normalizedPath)) return
      roots.set(normalizedPath, {
        id,
        path: normalizedPath,
        baseName: getBaseName(normalizedPath),
      })
    }

    baseFolders.forEach(folder => {
      addRootEntry(getWorkspaceFolderId(folder), getContextFolderPath(projectPath, folder))
    })
    externalRoots.forEach(root => {
      addRootEntry(root.id, root.path)
    })

    return Array.from(roots.values())
  }, [projectPath, baseFolders, externalRoots])
  const resolvedGraphRoots = useMemo<GraphRoot[]>(
    () => providedGraphRoots ?? computedGraphRoots,
    [providedGraphRoots, computedGraphRoots]
  )
  const viewScopeKey = useMemo(
    () => scopeId ?? projectPath ?? null,
    [scopeId, projectPath]
  )
  const rootItemsRef = useRef<Map<string, TreeItem[]>>(new Map())
  const rootByPathRef = useRef<Map<string, GraphRoot>>(new Map())
  const treeItemsRef = useRef<TreeItem[]>([])

  useEffect(() => {
    treeItemsRef.current = treeItems
  }, [treeItems])

  const loadParsedDoc = useCallback(async (item: TreeItem) => {
    if (item.is_dir) return
    const cached = controller.getCachedFile(item.path)
    const parsed = cached ?? await controller.loadParsedFile(item.path)
    if (parsed) {
      setDocContentParsed(item.id, parsed)
    }
  }, [controller, setDocContentParsed])

  const addExternalRootForPath = useCallback((targetPath: string) => {
    const normalized = normalizeFsPath(targetPath)
    const rootPath = normalizeRootPath(getParentDir(normalized))
    if (!rootPath) return
    setExternalRoots(prev => {
      if (prev.some(root => normalizeRootPath(root.path) === rootPath)) return prev
      return [
        ...prev,
        {
          id: getWorkspaceFolderId(rootPath),
          path: rootPath,
          baseName: getBaseName(rootPath),
        },
      ]
    })
  }, [])

  const findRootForPath = useCallback((path: string): GraphRoot | null => {
    let match: GraphRoot | null = null
    rootByPathRef.current.forEach((root) => {
      if (path === root.path || path.startsWith(`${root.path}/`)) {
        if (!match || root.path.length > match.path.length) {
          match = root
        }
      }
    })
    return match
  }, [])

  // Store React Flow instance ref for fitView
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowInstance = useRef<any>(null)

  // Container ref for viewport dimension tracking
  const containerRef = useRef<HTMLDivElement>(null)

  // Track viewport dimensions for ELK aspect ratio layout
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setViewportDimensions({ width, height })
        }
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [setViewportDimensions])

  // Auto-fit view when focus mode changes
  const prevFocusedNode = useRef(focusedNode)
  useEffect(() => {
    if (!isActive) return
    if (focusedNode !== prevFocusedNode.current) {
      prevFocusedNode.current = focusedNode
      setIsZoomedToNode(false) // Reset zoom state when focus changes
      // Delay to allow layout to complete
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, duration: 300 })
      }, 150)
    }
  }, [focusedNode, isActive])

  // Graph keyboard shortcuts via keybindings system
  const PAN_STEP = 50
  const FAST_PAN_STEP = 200

  const panGraph = useCallback((dx: number, dy: number) => {
    const instance = reactFlowInstance.current
    if (!instance || quickPreviewNode) return
    const viewport = instance.getViewport()
    instance.setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 100 })
  }, [quickPreviewNode])

  const zoomGraph = useCallback((delta: number) => {
    const instance = reactFlowInstance.current
    if (!instance) return
    const viewport = instance.getViewport()
    const newZoom = Math.min(Math.max(viewport.zoom + delta, 0.1), 2)
    instance.setViewport({ x: viewport.x, y: viewport.y, zoom: newZoom }, { duration: 100 })
  }, [])

  // Track last click time for manual double-click detection
  const lastClickTime = useRef<number>(0)
  const lastClickNode = useRef<string | null>(null)

  // React Flow state (synced from store)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Fullscreen modal state - rendered at this level to escape Panel clipping
  const [fullscreenState, setFullscreenState] = useState<FullscreenModalState>({ open: false, type: null, content: '' })
  const handleFullscreen = useCallback((state: FullscreenModalState) => setFullscreenState(state), [])
  const closeFullscreen = useCallback(() => setFullscreenState({ open: false, type: null, content: '' }), [])

  // Multi-select state for custom focus views
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<string[]>([])

  // Track which section to show in popover (for section node clicks)
  const [previewSectionIndex, setPreviewSectionIndex] = useState(0)

  // Track if graph container is focused (for subtle visual indicator)
  const [isGraphFocused, setIsGraphFocused] = useState(false)

  // Track keyboard navigation state
  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = useState(-1)
  const [isZoomedToNode, setIsZoomedToNode] = useState(false)

  const [docTypeFilters, setDocTypeFilters] = useState<Record<'core' | 'research' | 'spike' | 'other', boolean>>({
    core: true,
    research: true,
    spike: true,
    other: true,
  })
  const [showLegend, setShowLegend] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAllLinks, setShowAllLinks] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const [ignoredNodes, setIgnoredNodes] = useState<string[]>([])

  const docTypeOptions = useMemo(() => ([
    { key: 'core' as const, label: 'Core', color: colors.graphCore },
    { key: 'research' as const, label: 'Docs', color: colors.graphResearch },
    { key: 'spike' as const, label: 'Archive', color: colors.graphSpike },
    { key: 'other' as const, label: 'Other', color: colors.textSecondary },
  ]), [colors])

  // Navigate to next node with Tab
  const selectNextNode = useCallback(() => {
    if (nodes.length === 0) return
    const nextIndex = keyboardSelectedIndex < 0 ? 0 : (keyboardSelectedIndex + 1) % nodes.length
    setKeyboardSelectedIndex(nextIndex)
    setIsZoomedToNode(false)

    // Select the node in ReactFlow
    const nodeId = nodes[nextIndex].id
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })))

    // Pan to center the node
    const node = nodes[nextIndex]
    if (node && reactFlowInstance.current) {
      reactFlowInstance.current.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { duration: 200, zoom: reactFlowInstance.current.getViewport().zoom }
      )
    }
  }, [nodes, keyboardSelectedIndex, setNodes])

  // Navigate to previous node with Shift+Tab
  const selectPrevNode = useCallback(() => {
    if (nodes.length === 0) return
    const prevIndex = keyboardSelectedIndex <= 0 ? nodes.length - 1 : keyboardSelectedIndex - 1
    setKeyboardSelectedIndex(prevIndex)
    setIsZoomedToNode(false)

    // Select the node in ReactFlow
    const nodeId = nodes[prevIndex].id
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })))

    // Pan to center the node
    const node = nodes[prevIndex]
    if (node && reactFlowInstance.current) {
      reactFlowInstance.current.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { duration: 200, zoom: reactFlowInstance.current.getViewport().zoom }
      )
    }
  }, [nodes, keyboardSelectedIndex, setNodes])

  // Zoom to selected node or zoom back to fit all
  const zoomToSelectedNode = useCallback(() => {
    const instance = reactFlowInstance.current
    if (!instance) return

    if (isZoomedToNode) {
      // Zoom back to fit all
      instance.fitView({ padding: 0.2, duration: 300 })
      setIsZoomedToNode(false)
    } else if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < nodes.length) {
      // Zoom to the selected node
      const node = nodes[keyboardSelectedIndex]
      instance.fitView({ nodes: [node], padding: 0.3, duration: 300 })
      setIsZoomedToNode(true)
    } else {
      // No node selected, just fit all
      instance.fitView({ padding: 0.2, duration: 300 })
    }
  }, [nodes, keyboardSelectedIndex, isZoomedToNode])

  // Register graph keyboard shortcuts (host app provides the implementation via compat config).
  useGraphShortcuts({
    panUp: () => panGraph(0, PAN_STEP),
    panDown: () => panGraph(0, -PAN_STEP),
    panLeft: () => panGraph(PAN_STEP, 0),
    panRight: () => panGraph(-PAN_STEP, 0),
    fastPanUp: () => panGraph(0, FAST_PAN_STEP),
    fastPanDown: () => panGraph(0, -FAST_PAN_STEP),
    fastPanLeft: () => panGraph(FAST_PAN_STEP, 0),
    fastPanRight: () => panGraph(-FAST_PAN_STEP, 0),
    zoomIn: () => zoomGraph(0.15),
    zoomOut: () => zoomGraph(-0.15),
    fitView: () => reactFlowInstance.current?.fitView({ padding: 0.2, duration: 200 }),
    increaseCardScale,
    decreaseCardScale,
    nextNode: selectNextNode,
    prevNode: selectPrevNode,
    zoomToNode: zoomToSelectedNode,
  })

  // Sync store nodes/edges to React Flow, preserving measured dimensions and object identity
  const docTypeMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDocType>>()
    treeItems.forEach((item) => {
      map.set(item.id, getDocType(item.id, resolvedSettings))
    })
    return map
  }, [treeItems, resolvedSettings])

  const resolveNodeDocType = useCallback((node: Node): ReturnType<typeof getDocType> | null => {
    const rawType = node.data?.type as string | undefined
    if (rawType) {
      if (rawType === 'archive') return 'spike'
      if (rawType === 'core' || rawType === 'research' || rawType === 'spike' || rawType === 'other') {
        return rawType
      }
    }
    const parentDocId = node.data?.parentDocId as string | undefined
    if (parentDocId && docTypeMap.has(parentDocId)) {
      return docTypeMap.get(parentDocId) ?? null
    }
    const baseId = node.id.split('#')[0]
    if (docTypeMap.has(baseId)) {
      return docTypeMap.get(baseId) ?? null
    }
    return null
  }, [docTypeMap])

  const ignoredEntries = useMemo(() => ignoredNodes.map((id) => {
    const item = treeItems.find(entry => entry.id === id)
    return {
      id,
      label: item?.name ?? id,
    }
  }), [ignoredNodes, treeItems])

  const pinnedEntries = useMemo(() => Array.from(pinnedNodes).map((id) => {
    const item = treeItems.find(entry => entry.id === id)
    return {
      id,
      label: item?.name ?? id,
    }
  }), [pinnedNodes, treeItems])

  const filteredStoreNodes = useMemo(() => {
    const hasFilters = Object.values(docTypeFilters).some(value => !value)
    const hasIgnored = ignoredNodes.length > 0
    if (!hasFilters && !hasIgnored) return storeNodes

    const ignoredSet = new Set(ignoredNodes)
    return storeNodes.filter((node) => {
      if (ignoredSet.has(node.id)) return false
      for (const ignored of ignoredSet) {
        if (ignored && node.id.startsWith(`${ignored}/`)) return false
      }
      const parentDocId = node.data?.parentDocId as string | undefined
      if (parentDocId && ignoredSet.has(parentDocId)) return false
      if (pinnedNodes.has(node.id)) return true
      if (parentDocId && pinnedNodes.has(parentDocId)) return true
      const docType = resolveNodeDocType(node)
      if (!docType) return true
      return docTypeFilters[docType]
    })
  }, [docTypeFilters, ignoredNodes, pinnedNodes, resolveNodeDocType, storeNodes])

  const filteredStoreEdges = useMemo(() => {
    const nodeIds = new Set(filteredStoreNodes.map(node => node.id))
    const isFocusMode = Boolean(focusedNode || (customFocusNodes && customFocusNodes.length > 0))
    const allowAllLinks = showAllLinks || isFocusMode
    return storeEdges.filter(edge => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false
      if (edge.data?.edgeType !== 'link') return true
      if (allowAllLinks) return true

      const sourceWorking = matchesFolderId(edge.source, resolvedSettings.folders.working)
      const targetWorking = matchesFolderId(edge.target, resolvedSettings.folders.working)
      return sourceWorking && !targetWorking
    })
  }, [filteredStoreNodes, storeEdges, focusedNode, customFocusNodes, showAllLinks, resolvedSettings])

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []

    const item = treeItems.find(entry => entry.id === contextMenu.nodeId)
    const isDir = item?.is_dir ?? false
    const isFile = Boolean(item && !item.is_dir)
    const nodeType = contextMenu.nodeType
    const isPinned = pinnedNodes.has(contextMenu.nodeId)
    const isLocked = lockedNodes.has(contextMenu.nodeId)
    const isIgnored = ignoredNodes.includes(contextMenu.nodeId)
    const folderType = isDir ? getFolderType(contextMenu.nodeId, resolvedSettings) : null
    const isWorkingFolder = folderType === 'core'

    const canOpenEditor = isFile && Boolean(onOpenFile)
    const canOpenPanel = isFile
    const canCollapse = isDir && nodeType === 'folder'
    const canTreeWidget = isDir && nodeType === 'folder' && !isWorkingFolder
    const canExpandFolder = nodeType === 'filetree'

    const mapped = contextMenu.items.flatMap(menuItem => {
      if (menuItem.divider) return [menuItem]
      switch (menuItem.action) {
        case 'openEditor':
          return canOpenEditor ? [menuItem] : []
        case 'openPanel':
          return canOpenPanel ? [menuItem] : []
        case 'collapse':
          return canCollapse ? [menuItem] : []
        case 'treeWidget':
          return canTreeWidget ? [menuItem] : []
        case 'expandFolder':
          return canExpandFolder ? [menuItem] : []
        default:
          return [menuItem]
      }
    }).map(menuItem => {
      if (menuItem.divider) return menuItem
      let label = menuItem.label
      if (menuItem.action === 'pin') label = isPinned ? 'Unpin' : 'Pin'
      if (menuItem.action === 'lock') label = isLocked ? 'Unlock position' : 'Lock position'
      if (menuItem.action === 'ignore') label = isIgnored ? 'Unignore' : 'Ignore'
      if (menuItem.action === 'collapse') label = collapsedFolders.has(contextMenu.nodeId) ? 'Expand' : 'Collapse'
      if (menuItem.action === 'expandFolder') label = 'Show as Folder'
      return { ...menuItem, label }
    })

    const compact: typeof mapped = []
    mapped.forEach(menuItem => {
      if (menuItem.divider) {
        if (compact.length === 0 || compact[compact.length - 1].divider) return
        compact.push(menuItem)
      } else {
        compact.push(menuItem)
      }
    })
    if (compact.length > 0 && compact[compact.length - 1].divider) {
      compact.pop()
    }

    return compact
  }, [
    contextMenu,
    treeItems,
    pinnedNodes,
    lockedNodes,
    ignoredNodes,
    onOpenFile,
    resolvedSettings,
    collapsedFolders,
  ])

  useEffect(() => {
    setNodes(currentNodes => {
      const newIds = new Set(filteredStoreNodes.map(n => n.id))
      const currentIds = new Set(currentNodes.map(n => n.id))

      // Check if structure actually changed
      const structureChanged = newIds.size !== currentIds.size ||
        [...newIds].some(id => !currentIds.has(id))

      if (!structureChanged) {
        // Structure same - only update nodes that actually changed
        let hasChanges = false
        const result = currentNodes.map(currentNode => {
          const storeNode = storeNodes.find(n => n.id === currentNode.id)
          if (!storeNode) return currentNode

          // Check if node data or position changed
          const dataChanged = currentNode.data !== storeNode.data
          const posChanged = currentNode.position.x !== storeNode.position.x ||
                            currentNode.position.y !== storeNode.position.y

          if (dataChanged || posChanged) {
            hasChanges = true
            return {
              ...currentNode, // Keep ReactFlow's internal state including measured
              data: storeNode.data,
              position: storeNode.position,
            }
          }
          return currentNode // Keep exact same object reference
        })
        return hasChanges ? result : currentNodes
      }

      // Structure changed - rebuild but preserve measured from current nodes
      const measuredMap = new Map(currentNodes.map(n => [n.id, n.measured]))
      return filteredStoreNodes.map(node => ({
        ...node,
        measured: measuredMap.get(node.id) ?? node.measured,
      }))
    })
    setEdges(filteredStoreEdges)
  }, [filteredStoreNodes, filteredStoreEdges, setNodes, setEdges])

  // Auto-relayout after nodes get measured (first render)
  const hasRelayoutedRef = useRef(false)
  useEffect(() => {
    if (!isActive) return
    if (hasRelayoutedRef.current) return
    if (nodes.length === 0) return

    // Check if most nodes have measurements
    const measuredCount = nodes.filter(n => n.measured?.width && n.measured?.height).length
    if (measuredCount < nodes.length * 0.8) return  // Wait for 80% to be measured

    // Collect measurements and trigger relayout
    const measured = new Map<string, { width: number; height: number }>()
    nodes.forEach(node => {
      if (node.measured?.width && node.measured?.height) {
        measured.set(node.id, { width: node.measured.width, height: node.measured.height })
      }
    })

    if (measured.size > 0) {
      hasRelayoutedRef.current = true
      setMeasuredDimensions(measured)
      // Small delay to let state update
      setTimeout(() => rebuildGraph(true), 50)
    }
  }, [nodes, setMeasuredDimensions, rebuildGraph, isActive])

  // Reset relayout flag when view changes
  useEffect(() => {
    hasRelayoutedRef.current = false
  }, [focusedNode, viewScopeKey])

  // Sync project path into the store
  useEffect(() => {
    if (!viewScopeKey) return
    setProjectPath(viewScopeKey)
  }, [setProjectPath, viewScopeKey])

  // Load tree and hydrate parsed markdown from background cache
  useEffect(() => {
    if (!isActive) return
    rootItemsRef.current = new Map()
    rootByPathRef.current = new Map(resolvedGraphRoots.map(root => [root.path, root]))

    if (resolvedGraphRoots.length === 0) {
      setTreeItems([])
      return
    }

    // Load all graph roots and set up watching via FileParserService
    const loadGraphRoots = async () => {
      await controller.ensureParsersRegistered()

      for (const root of resolvedGraphRoots) {
        try {
          // Load file tree structure
          const items = await controller.getFileTree(root.path)
          const currentRoot = rootByPathRef.current.get(root.path)
          if (!currentRoot) continue
          const remapped = remapTreeItems(items, currentRoot)
          rootItemsRef.current.set(root.path, remapped)
          const merged: TreeItem[] = []
          const seen = new Set<string>()
          rootItemsRef.current.forEach((rootItems) => {
            rootItems.forEach((item) => {
              if (seen.has(item.id)) return
              seen.add(item.id)
              merged.push(item)
            })
          })
          merged.sort((a, b) => a.id.localeCompare(b.id))
          setTreeItems(merged)

          for (const item of remapped) {
            if (!item.is_dir && item.path.endsWith('.md')) {
              await loadParsedDoc(item)
            }
          }
        } catch (err) {
          console.error('Failed to load graph root:', root.path, err)
        }
      }
    }
    loadGraphRoots()
  }, [controller, resolvedGraphRoots, setTreeItems, loadParsedDoc, isActive])

  // Cleanup handled by the graphRoots effect above

  useEffect(() => {
    setProjectSettings(resolvedSettings)
  }, [resolvedSettings, setProjectSettings])

  // Handle file changes - FileParserService handles modified files,
  // controller watch handles tree structure changes (created/removed)
  useEffect(() => {
    if (!isActive) return
    if (resolvedGraphRoots.length === 0) return

    const cleanupFns: Array<() => void> = []
    let disposed = false

    // Subscribe to FileParserService for content updates
    // subscribeAll() handles all efficiency concerns (debounce, caching, etc.)
    // and gives us pre-parsed data - no re-reading or re-parsing needed
    for (const root of resolvedGraphRoots) {
      const unsub = controller.subscribeParsedRoot(root.path, (filePath, parsedData) => {
        const item = treeItemsRef.current.find(t => t.path === filePath)
        if (item && !item.is_dir) {
          setDocContentParsed(item.id, parsedData)
        }
      })
      cleanupFns.push(unsub)
    }

    // Use controller watch for tree structure changes (created/removed)
    const watchPaths = resolvedGraphRoots.map(r => r.path)
    const handleTreeChange = async (event: { type: string; path: string }) => {
      if (event.type !== 'created' && event.type !== 'removed') return

      const root = findRootForPath(event.path)
      if (!root) return

      try {
        const items = await controller.getFileTree(root.path)
        const currentRoot = rootByPathRef.current.get(root.path)
        if (!currentRoot) return
        const remapped = remapTreeItems(items, currentRoot)
        rootItemsRef.current.set(root.path, remapped)
        const merged: TreeItem[] = []
        const seen = new Set<string>()
        rootItemsRef.current.forEach((rootItems) => {
          rootItems.forEach((item) => {
            if (seen.has(item.id)) return
            seen.add(item.id)
            merged.push(item)
          })
        })
        merged.sort((a, b) => a.id.localeCompare(b.id))
        setTreeItems(merged)

        // Auto-load new markdown files
        for (const item of remapped) {
          if (!item.is_dir && item.path.endsWith('.md')) {
            await loadParsedDoc(item)
          }
        }
      } catch (err) {
        console.error('Failed to reload tree after file change:', err)
      }
    }

    controller.watchTreePaths(watchPaths, 'document-graph-tree', handleTreeChange)
      .then(unwatch => {
        if (disposed) {
          unwatch()
          return
        }
        cleanupFns.push(unwatch)
      })
      .catch((err) => console.error('[DocumentGraph] Failed to watch graph roots:', err))

    return () => {
      disposed = true
      for (const fn of cleanupFns) {
        fn()
      }
    }
  }, [controller, resolvedGraphRoots, findRootForPath, setTreeItems, loadParsedDoc, setDocContentParsed, isActive])

  // Legacy IPC response handler removed - all operations now use direct Tauri calls

  // Single unified click handler - detects double clicks manually
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const now = Date.now()
    const isDoubleClick = (now - lastClickTime.current < 300) && (lastClickNode.current === node.id)

    lastClickTime.current = now
    lastClickNode.current = node.id

    // Double-click: toggle zoom (zoom to node or zoom back out)
    if (isDoubleClick) {
      setQuickPreviewNode(null)
      const instance = reactFlowInstance.current
      if (!instance) return

      if (isZoomedToNode) {
        // Zoom back to fit all nodes
        instance.fitView({ padding: 0.2, duration: 300 })
        setIsZoomedToNode(false)
      } else {
        // Zoom with node's top edge at top of viewport
        const internalNode = instance.getInternalNode(node.id)
        const zoom = 1.3
        const viewportHeight = instance.getViewport().zoom > 0
          ? window.innerHeight / zoom
          : 600

        if (internalNode?.measured?.width && internalNode?.measured?.height) {
          const centerX = internalNode.internals.positionAbsolute.x + internalNode.measured.width / 2
          // Offset Y so node top appears near viewport top with padding
          const centerY = internalNode.internals.positionAbsolute.y + (viewportHeight / 2) - 80
          instance.setCenter(centerX, centerY, { zoom, duration: 300 })
        } else {
          const centerY = node.position.y + (viewportHeight / 2) - 80
          instance.setCenter(node.position.x + 100, centerY, { zoom, duration: 300 })
        }
        setIsZoomedToNode(true)
      }
      return
    }

    // Single click behavior depends on node type

    // Folder: toggle on single click
    if (node.type === 'folder') {
      toggleFolderCollapse(node.id)
      return
    }

    // Breakout node types (not documents) - single click does nothing
    const breakoutTypes = ['toc', 'tasklist', 'checklist', 'diagram', 'link-card']
    if (breakoutTypes.includes(node.type || '')) {
      return
    }

    // Document nodes: no single-click preview (use Preview button instead)
    if (node.type === 'document' || node.type === 'filetree' || node.type === 'workingdoc') {
      return
    }
  }, [toggleFolderCollapse, setQuickPreviewNode, treeItems, loadParsedDoc, isZoomedToNode])

  // Save node position when dragging ends
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (lockedNodes.has(node.id)) return
    updateNodePosition(node.id, node.position)
  }, [lockedNodes, updateNodePosition])

  // Right-click context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    showContextMenu(event.clientX, event.clientY, node.id, node.type || 'document')
  }, [showContextMenu])

  // Track multi-selection changes
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selectedNodes }) => {
    setMultiSelectedNodes(selectedNodes.map(n => n.id))
  }, [])

  // Focus on selected nodes (custom multi-select focus)
  const handleFocusSelection = useCallback(() => {
    if (multiSelectedNodes.length < 2) return
    // Set focus to the first selected node, store will include all selected
    setFocusedNode(multiSelectedNodes[0], multiSelectedNodes)
    setMultiSelectedNodes([])
  }, [multiSelectedNodes, setFocusedNode])

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setMultiSelectedNodes([])
    // Clear ReactFlow selection by setting all nodes to selected: false
    setNodes(nodes => nodes.map(n => ({ ...n, selected: false })))
  }, [setNodes])

  // Handler for TOC section clicks
  const handleTocSectionClick = useCallback((parentDocId: string, sectionIndex: number) => {
    // Open the parent document popover with section index
    setQuickPreviewNode(parentDocId)
    setPreviewSectionIndex(sectionIndex)
    // Ensure document content is loaded
    const item = treeItems.find(t => t.id === parentDocId)
    if (item) {
      void loadParsedDoc(item)
    }
  }, [treeItems, loadParsedDoc, setQuickPreviewNode])

  const handlePreviewNode = useCallback((nodeId: string) => {
    setQuickPreviewNode(nodeId)
    setPreviewSectionIndex(0)
    const item = treeItems.find(t => t.id === nodeId)
    if (item) {
      void loadParsedDoc(item)
    }
  }, [setQuickPreviewNode, setPreviewSectionIndex, treeItems, loadParsedDoc])

  useEffect(() => {
    if (!pendingLinkOpen) return
    const normalizedTarget = normalizeFsPath(pendingLinkOpen.path)
    const item = treeItemsRef.current.find(t => normalizeFsPath(t.path) === normalizedTarget)
    if (!item) return
    if (pendingLinkOpen.action === 'panel') {
      openFullView(item.id)
    } else {
      handlePreviewNode(item.id)
    }
    setPendingLinkOpen(null)
  }, [pendingLinkOpen, openFullView, handlePreviewNode])

  const handleFocusNode = useCallback((nodeId: string) => {
    setFocusedNode(nodeId)
  }, [setFocusedNode])

  const handleLinkAction = useCallback((
    link: { targetId?: string; targetPath?: string },
    action: 'preview' | 'panel' | 'editor' | 'follow'
  ) => {
    const targetId = link.targetId
    const targetPath = link.targetPath

    if (targetId) {
      if (action === 'preview') {
        handlePreviewNode(targetId)
        return
      }
      if (action === 'panel') {
        openFullView(targetId)
        return
      }
      if (action === 'editor') {
        const item = treeItemsRef.current.find(t => t.id === targetId)
        if (item) {
          onOpenFile?.(item.path)
        } else if (targetPath) {
          onOpenFile?.(targetPath)
        }
        return
      }
      return
    }

    if (!targetPath) return

    if (action === 'follow') {
      addExternalRootForPath(targetPath)
      return
    }
    if (action === 'preview') {
      addExternalRootForPath(targetPath)
      setPendingLinkOpen({ path: targetPath, action: 'preview' })
      return
    }
    if (action === 'panel') {
      addExternalRootForPath(targetPath)
      setPendingLinkOpen({ path: targetPath, action: 'panel' })
      return
    }
    if (action === 'editor') {
      onOpenFile?.(targetPath)
    }
  }, [handlePreviewNode, openFullView, onOpenFile, addExternalRootForPath, setPendingLinkOpen])

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string, nodeId: string, _nodeType: string) => {
    closeContextMenu()
    switch (action) {
      case 'openPanel':
        openFullView(nodeId)
        break
      case 'focus':
        setFocusedNode(nodeId)
        break
      case 'collapse':
        toggleFolderCollapse(nodeId)
        break
      case 'treeWidget':
        // Toggle tree widget display for this folder
        toggleTreeWidget(nodeId)
        break
      case 'openEditor':
        if (onOpenFile) {
          const item = treeItems.find(t => t.id === nodeId)
          if (item) onOpenFile(item.path)
        }
        break
      case 'expandFolder':
        toggleTreeWidget(nodeId)
        if (collapsedFolders.has(nodeId)) {
          toggleFolderCollapse(nodeId)
        }
        break
      case 'ignore':
        setIgnoredNodes((prev) => (
          prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
        ))
        break
      case 'pin':
        togglePinnedNode(nodeId)
        break
      case 'lock':
        toggleLockedNode(nodeId)
        break
    }
  }, [
    closeContextMenu,
    openFullView,
    setFocusedNode,
    toggleFolderCollapse,
    toggleTreeWidget,
    collapsedFolders,
    treeItems,
    onOpenFile,
    togglePinnedNode,
    toggleLockedNode,
    storeNodes,
    addExternalRootForPath,
    setPendingLinkOpen,
  ])

  // Add handlers and cardScale to nodes (clicks handled by ReactFlow)
  const nodesWithHandlers = nodes.map(node => {
    const baseData = {
      ...node.data,
      cardScale, // Pass scale to all nodes
    }

    if (node.type === 'toc') {
      const parentDocId = node.data?.parentDocId as string
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onSectionClick: (sectionIndex: number) => handleTocSectionClick(parentDocId, sectionIndex),
        },
      }
    }
    if (node.type === 'filetree') {
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onItemClick: (_item: { id: string; name: string; path: string; is_dir: boolean }) => {
            // No single-click preview for tree items (use context menu / buttons)
          },
          onItemContextMenu: (e: React.MouseEvent, item: { id: string; name: string; path: string; is_dir: boolean }) => {
            e.preventDefault()
            // Show context menu for tree items
            showContextMenu(e.clientX, e.clientY, item.id, item.is_dir ? 'treeitem-folder' : 'treeitem-file')
          },
          onToggleView: () => {
            toggleTreeWidget(node.id)
            if (collapsedFolders.has(node.id)) {
              toggleFolderCollapse(node.id)
            }
          },
        },
      }
    }
    if (node.type === 'link-card') {
      return {
        ...node,
        draggable: !lockedNodes.has(node.id),
        data: {
          ...baseData,
          onLinkAction: handleLinkAction,
        },
      }
    }
    const isDocCard = node.type === 'document' || node.type === 'workingdoc'
    return {
      ...node,
      draggable: !lockedNodes.has(node.id),
      data: {
        ...baseData,
        onEdit: node.data?.path ? () => onOpenFile?.(node.data.path as string) : undefined,
        onPreview: isDocCard ? () => handlePreviewNode(node.id) : undefined,
        onFocus: isDocCard ? () => handleFocusNode(node.id) : undefined,
      },
    }
  })

  if (!viewScopeKey) {
    return (
      <div style={{ padding: '20px', color: colors.textMuted }}>
        Select a project to view documentation
      </div>
    )
  }

  return (
    <div style={{ ...layoutPrimitives.fillColumn, background: colors.bgPrimary }}>
      {/* Graph Panel */}
      <div style={{
        ...layoutPrimitives.fillColumn,
        flex: 1,
        borderBottom: `1px solid ${colors.borderPrimary}`,
        height: '100%',
      }}>
        <div
          ref={containerRef}
          data-graph-container
          style={{
            ...layoutPrimitives.fill,
            outline: 'none',
            boxShadow: isGraphFocused ? `inset 0 0 0 1px ${colors.borderFocus}` : 'none',
            transition: 'box-shadow 0.15s ease',
            position: 'relative', // For absolute positioning of QuickPreview
          }}
          tabIndex={0}
          onFocus={() => {
            scopeManager.push('graph')
            setIsGraphFocused(true)
          }}
          onBlur={() => {
            scopeManager.remove('graph')
            setIsGraphFocused(false)
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <ReactFlow
              nodes={nodesWithHandlers}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onNodeContextMenu={handleNodeContextMenu}
              onPaneClick={() => { setQuickPreviewNode(null); closeContextMenu() }}
              onInit={(instance) => { reactFlowInstance.current = instance }}
              onSelectionChange={handleSelectionChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              selectionOnDrag={true}
              selectNodesOnDrag={true}
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              panOnScroll={true}
              panOnDrag={true}
              zoomOnDoubleClick={false}
              deleteKeyCode={null}
              selectionMode={SelectionMode.Partial}
              disableKeyboardA11y={true}
              style={{ ...layoutPrimitives.fill }}
            >
              <Background color={colors.borderPrimary} gap={20} />
              <Controls style={{ background: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}` }} />
              <GraphControlPanel
                onRelayout={() => {
                  // Collect measured dimensions from current nodes
                  const instance = reactFlowInstance.current
                  if (instance) {
                    const rfNodes = instance.getNodes()
                    const measured = new Map<string, { width: number; height: number }>()
                    rfNodes.forEach((node: Node) => {
                      if (node.measured?.width && node.measured?.height) {
                        measured.set(node.id, {
                          width: node.measured.width,
                          height: node.measured.height,
                        })
                      }
                    })
                    if (measured.size > 0) {
                      setMeasuredDimensions(measured)
                    }
                  }
                  clearViewLayout()
                  rebuildGraph(true)
                }}
                onFitView={() => reactFlowInstance.current?.fitView({ padding: 0.2, duration: 200 })}
                nodeCount={nodes.length}
                onToggleLegend={() => {
                  setShowLegend(prev => !prev)
                  setShowFilters(false)
                  setShowIgnored(false)
                  setShowPinned(false)
                }}
                onToggleFilters={() => {
                  setShowFilters(prev => !prev)
                  setShowLegend(false)
                  setShowIgnored(false)
                  setShowPinned(false)
                }}
                onToggleIgnored={() => {
                  setShowIgnored(prev => !prev)
                  setShowLegend(false)
                  setShowFilters(false)
                  setShowPinned(false)
                }}
                onTogglePinned={() => {
                  setShowPinned(prev => !prev)
                  setShowLegend(false)
                  setShowFilters(false)
                  setShowIgnored(false)
                }}
                isLegendOpen={showLegend}
                isFiltersOpen={showFilters}
                isPinnedOpen={showPinned}
                ignoredCount={ignoredNodes.length}
                pinnedCount={pinnedNodes.size}
              >
                {showLegend && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.borderSecondary}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      boxShadow: shadows.md,
                      zIndex: 20,
                      minWidth: 160,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
                      Legend
                    </div>
                    {docTypeOptions.map(option => (
                      <div key={option.key} style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6, padding: '2px 0' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: option.color,
                          }}
                        />
                        <span style={{ fontSize: 11, color: colors.textPrimary }}>{option.label}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, fontSize: 10, color: colors.textSecondary }}>
                      Link Edges
                    </div>
                    <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6, padding: '2px 0' }}>
                      <span
                        style={{
                          width: 18,
                          height: 0,
                          borderTop: `2px dashed ${colors.warning}`,
                        }}
                      />
                      <span style={{ fontSize: 11, color: colors.textPrimary }}>Links</span>
                    </div>
                  </div>
                )}
                {showFilters && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.borderSecondary}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      boxShadow: shadows.md,
                      zIndex: 20,
                      minWidth: 180,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
                      Document Types
                    </div>
                    {docTypeOptions.map(option => {
                      const isActive = docTypeFilters[option.key]
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setDocTypeFilters(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                          style={{
                            ...layoutPrimitives.row,
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: 6,
                            border: `1px solid ${isActive ? colors.accent : colors.borderSecondary}`,
                            background: isActive ? colors.bgSecondary : 'transparent',
                            color: isActive ? colors.textPrimary : colors.textMuted,
                            cursor: 'pointer',
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: isActive ? option.color : colors.borderSecondary,
                            }}
                          />
                          {option.label}
                        </button>
                      )
                    })}
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: colors.textSecondary }}>
                      Link Edges
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllLinks(prev => !prev)}
                      style={{
                        marginTop: 4,
                        width: '100%',
                        border: `1px solid ${showAllLinks ? colors.warning : colors.borderSecondary}`,
                        background: showAllLinks ? `${colors.warning}20` : colors.buttonBg,
                        color: showAllLinks ? colors.textPrimary : colors.textSecondary,
                        padding: '4px 6px',
                        borderRadius: 6,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      {showAllLinks ? 'Show working-only links' : 'Show all links'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocTypeFilters({ core: true, research: true, spike: true, other: true })}
                      style={{
                        marginTop: 4,
                        width: '100%',
                        border: `1px solid ${colors.borderSecondary}`,
                        background: colors.buttonBg,
                        color: colors.textSecondary,
                        padding: '4px 6px',
                        borderRadius: 6,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}
                {showIgnored && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.borderSecondary}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      boxShadow: shadows.md,
                      zIndex: 20,
                      minWidth: 200,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
                      Ignored Items
                    </div>
                    {ignoredEntries.length === 0 ? (
                      <div style={{ fontSize: 11, color: colors.textMuted }}>No ignored nodes</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {ignoredEntries.map(entry => (
                          <div key={entry.id} style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 11, color: colors.textPrimary }}>{entry.label}</span>
                            <button
                              type="button"
                              onClick={() => setIgnoredNodes(prev => prev.filter(id => id !== entry.id))}
                              style={{
                                border: 'none',
                                background: colors.buttonBg,
                                color: colors.textSecondary,
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setIgnoredNodes([])}
                          style={{
                            border: `1px solid ${colors.borderSecondary}`,
                            background: colors.buttonBg,
                            color: colors.textSecondary,
                            fontSize: 10,
                            padding: '4px 6px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Restore all
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {showPinned && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.borderSecondary}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      boxShadow: shadows.md,
                      zIndex: 20,
                      minWidth: 220,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
                      Pinned Items
                    </div>
                    {pinnedEntries.length === 0 ? (
                      <div style={{ fontSize: 11, color: colors.textMuted }}>No pinned nodes</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {pinnedEntries.map(entry => (
                          <div key={entry.id} style={{ display: 'grid', gap: 4 }}>
                            <div style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 11, color: colors.textPrimary }}>{entry.label}</span>
                              <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => setFocusedNode(entry.id)}
                                  style={{
                                    border: `1px solid ${colors.borderSecondary}`,
                                    background: colors.buttonBg,
                                    color: colors.textSecondary,
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Focus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => togglePinnedNode(entry.id)}
                                  style={{
                                    border: 'none',
                                    background: colors.buttonBg,
                                    color: colors.textSecondary,
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Unpin
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleLockedNode(entry.id)}
                              style={{
                                border: `1px solid ${colors.borderSecondary}`,
                                background: lockedNodes.has(entry.id) ? colors.bgSecondary : colors.buttonBg,
                                color: colors.textSecondary,
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                alignSelf: 'flex-start',
                              }}
                            >
                              {lockedNodes.has(entry.id) ? 'Unlock position' : 'Lock position'}
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setLockedNodes(new Set())
                            setPinnedNodes(new Set())
                          }}
                          style={{
                            border: `1px solid ${colors.borderSecondary}`,
                            background: colors.buttonBg,
                            color: colors.textSecondary,
                            fontSize: 10,
                            padding: '4px 6px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Clear pins
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </GraphControlPanel>
              {/* Focus Mode Breadcrumbs - rendered last so it's on top */}
              {(focusedNode || customFocusNodes) && (
                <FocusBreadcrumbs
                  focusedNode={focusedNode || ''}
                  breadcrumbs={getFocusBreadcrumbs()}
                  customFocusCount={customFocusNodes?.length}
                  onExitFocus={() => setFocusedNode(null)}
                  onFocusNode={(id) => id === 'CLAUDE.md' ? setFocusedNode(null) : setFocusedNode(id)}
                />
              )}
              <MiniMap
                style={{ background: colors.bgPrimary, border: `1px solid ${colors.borderPrimary}` }}
                nodeColor={(node) => {
                  if (node.type === 'folder') return colors.graphFolder
                  return colors.accent
                }}
                pannable
                zoomable
              />
              {/* Selection Panel for multi-select */}
              <SelectionPanel
                selectedCount={multiSelectedNodes.length}
                onFocusSelection={handleFocusSelection}
                onClearSelection={handleClearSelection}
              />
              {/* Context Menu */}
              {contextMenu && contextMenuItems.length > 0 && (
                <div
                  style={{
                    position: 'fixed',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    background: colors.bgTertiary,
                    border: `1px solid ${colors.borderSecondary}`,
                    borderRadius: '4px',
                    boxShadow: shadows.lg,
                    zIndex: 1000,
                    minWidth: '160px',
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {contextMenuItems.map((item, i) => (
                    item.divider ? (
                      <div
                        key={`divider-${i}`}
                        style={{
                          height: 1,
                          background: colors.borderSecondary,
                          margin: '4px 0',
                        }}
                      />
                    ) : (
                      <button
                        key={`${item.action}-${i}`}
                        onClick={item.disabled ? undefined : () => handleContextMenuAction(item.action, contextMenu.nodeId, contextMenu.nodeType)}
                        disabled={item.disabled}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          background: 'transparent',
                          border: 'none',
                          color: item.disabled ? colors.textMuted : colors.textPrimary,
                          textAlign: 'left',
                          cursor: item.disabled ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                        }}
                        onMouseEnter={(e) => {
                          if (!item.disabled) (e.target as HTMLElement).style.background = colors.buttonBgHover
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        {item.label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </ReactFlow>
          </div>
          {/* Quick Preview Popover - rendered outside ReactFlow for proper mouse handling */}
          {quickPreviewNode && (() => {
            const item = treeItems.find(t => t.id === quickPreviewNode)
            const content = docContents.get(quickPreviewNode)
            if (!item) return null
            const docType = getDocType(item.id, resolvedSettings)
            return (
              <QuickPreview
                name={item.name}
                type={docType}
                isFile={!item.is_dir}
                tasks={content?.tasks}
                content={content?.content}
                sections={content?.sections}
                checklists={content?.checklists}
                diagrams={content?.diagrams}
                sourceFile={item.path}
                onClose={() => {
                  setQuickPreviewNode(null)
                  setPreviewSectionIndex(0)
                }}
                onOpenFull={!item.is_dir ? () => openFullView(quickPreviewNode) : undefined}
                onEdit={onOpenFile ? () => onOpenFile(item.path) : undefined}
                onFullscreen={handleFullscreen}
                onFocus={() => {
                  setFocusedNode(quickPreviewNode)
                  setQuickPreviewNode(null)
                }}
                initialSectionIndex={previewSectionIndex}
                position={previewPanelPosition}
                onPositionChange={setPreviewPanelPosition}
              />
            )
          })()}
        </div>
      </div>

      {/* Document Panels */}
      {selectedNodes.map(nodeId => {
        const item = treeItems.find(t => t.id === nodeId)
        const content = docContents.get(nodeId)
        if (!item) return null

        const isExpanded = expandedPanel === nodeId

        return (
          <div key={nodeId} style={{
            ...layoutPrimitives.column,
            flex: isExpanded ? 1 : '0 0 auto',
            height: isExpanded ? '100%' : 'auto',
            minHeight: isExpanded ? 0 : 'auto',
            width: '100%',
            borderBottom: `1px solid ${colors.borderPrimary}`,
          }}>
            <div
              onClick={() => setExpandedPanel(isExpanded ? null : nodeId)}
              style={{
                padding: '8px 12px',
                ...layoutPrimitives.row,
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                background: isExpanded ? colors.bgTertiary : colors.bgSecondary,
                userSelect: 'none',
              }}
            >
              <Icon icon={isExpanded ? icons.chevronDown : icons.chevronRight} size="xs" style={{ color: colors.textSecondary }} />
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: item.is_dir ? colors.graphFolder : colors.accent,
              }} />
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '12px', flex: 1 }}>
                {item.name.replace('.md', '')}
              </span>

              {!item.is_dir && onOpenFile && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenFile(item.path) }}
                  style={{
                    background: colors.accent,
                    border: 'none',
                    color: colors.textInverse,
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); closeNode(nodeId) }}
                style={{
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                }}
              >
                <Icon icon={icons.close} size="xs" />
              </button>
            </div>

            {isExpanded && content && (() => {
              // Determine type color for this document
              const docType = getDocType(item.id, resolvedSettings)
              const typeColor = docType === 'core' ? colors.graphCore :
                               docType === 'research' ? colors.graphResearch :
                               docType === 'spike' ? colors.graphSpike : colors.graphFolder

              return (
                <div style={{
                  overflow: 'hidden',
                  padding: '12px',
                  background: colors.bgPrimary,
                  ...layoutPrimitives.fillColumn,
                }}>
                  <SectionView content={content.content} typeColor={typeColor} sections={content.sections} onFullscreen={handleFullscreen} />
                </div>
              )
            })()}

            {isExpanded && !content && !item.is_dir && (
              <div style={{ padding: '12px', color: colors.textMuted }}>
                Loading...
                {/* Request content if not loaded */}
                {(() => {
                  void loadParsedDoc(item)
                  return null
                })()}
              </div>
            )}
          </div>
        )
      })}

      {/* Fullscreen Modal - rendered at top level outside all Panels to escape clipping */}
      <FullscreenModal state={fullscreenState} onClose={closeFullscreen} />
    </div>
  )
}
