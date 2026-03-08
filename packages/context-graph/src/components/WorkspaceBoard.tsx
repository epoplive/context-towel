// ============================================================================
// WorkspaceBoard — Visual working memory canvas
//
// Takes markdown content, extracts diagrams/tasks/checklists,
// renders them as interactive nodes on a ReactFlow canvas.
// History sidebar shows changelog. Source links drill into code.
//
// Usage: import { WorkspaceBoard } from '@context-towel/context-graph/embed'
// ============================================================================

import { useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes, edgeTypes } from './FlowNodes'
import { useTheme, useMermaidTheme } from '../compat/design-system'
import { layoutPrimitives } from '../compat/layoutPrimitives'
import { parseDiagrams } from '../plugins/diagram/parser'
import { parseTasks } from '../plugins/task/parser'

// ── Types ────────────────────────────────────────────────────────

export interface WorkspaceContentItem {
  /** Markdown content containing diagrams, tasks, etc. */
  content: string
  /** Source file path this content came from */
  sourceFile: string
  /** Display label for this content source */
  label?: string
}

export interface WorkspaceHistoryEntry {
  timestamp: string
  entry: string
}

export interface WorkspaceBoardProps {
  /** Markdown content items to parse and display. Can also pass a single string. */
  items: WorkspaceContentItem[] | string
  /** Single source file path (used when items is a string) */
  sourceFile?: string
  /** Changelog/history entries for the sidebar */
  history?: WorkspaceHistoryEntry[]
  /** Callback when user clicks a source reference */
  onOpenSource?: (file: string, line?: number) => void
  /** Whether the board is currently visible (for performance) */
  isVisible?: boolean
  /** Show the history sidebar */
  showHistory?: boolean
}

// ── Layout helpers ──────────────────────────────────────────────

interface ParsedNode {
  type: 'diagram' | 'task'
  data: Record<string, unknown>
  width: number
  height: number
}

function layoutNodes(parsed: ParsedNode[]): Node[] {
  const nodes: Node[] = []
  const PADDING = 40
  const COL_WIDTH = 650
  let x = PADDING
  let y = PADDING
  let colMaxHeight = 0
  let col = 0

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    const id = `ws-${item.type}-${i}`
    const estimatedHeight = item.type === 'diagram' ? 450 : 200

    nodes.push({
      id,
      type: item.type,
      position: { x, y },
      data: item.data,
    })

    y += estimatedHeight + PADDING
    colMaxHeight = Math.max(colMaxHeight, y)

    // Start new column after 3 nodes
    if ((i + 1) % 3 === 0) {
      col++
      x = PADDING + col * (COL_WIDTH + PADDING)
      y = PADDING
    }
  }

  return nodes
}

// ── Component ───────────────────────────────────────────────────

export function WorkspaceBoard({
  items,
  sourceFile: defaultSourceFile,
  history,
  onOpenSource,
  isVisible = true,
  showHistory = true,
}: WorkspaceBoardProps) {
  const { colors } = useTheme()
  useMermaidTheme()

  const containerRef = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<any>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Normalize input to content items
  const contentItems = useMemo<WorkspaceContentItem[]>(() => {
    if (typeof items === 'string') {
      return [{ content: items, sourceFile: defaultSourceFile ?? 'workspace', label: 'Workspace' }]
    }
    return items
  }, [items, defaultSourceFile])

  // Parse content and build nodes
  useEffect(() => {
    if (!isVisible) return

    const parsed: ParsedNode[] = []

    for (const item of contentItems) {
      // Parse diagrams
      const diagramResult = parseDiagrams(item.content, item.sourceFile)
      for (const diagram of diagramResult.items) {
        parsed.push({
          type: 'diagram',
          data: {
            diagram,
            parentDocId: item.sourceFile,
            sourceFile: item.sourceFile,
            sourceLine: diagram.sourceLine,
            onOpenSource,
          },
          width: 600,
          height: 450,
        })
      }

      // Parse tasks
      const taskResult = parseTasks(item.content, item.sourceFile)
      for (const task of taskResult.items) {
        parsed.push({
          type: 'task',
          data: {
            task,
            parentDocId: item.sourceFile,
            sourceFile: item.sourceFile,
            sourceLine: task.sourceLine,
            onOpenSource,
          },
          width: 350,
          height: 200,
        })
      }
    }

    const layouted = layoutNodes(parsed)
    setNodes(layouted)
    setEdges([])

    // Fit view after nodes render
    setTimeout(() => {
      reactFlowInstance.current?.fitView({ padding: 0.15, duration: 200 })
    }, 100)
  }, [contentItems, isVisible, onOpenSource, setNodes, setEdges])

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as Record<string, unknown>
    if (onOpenSource && data.sourceFile) {
      onOpenSource(data.sourceFile as string, data.sourceLine as number | undefined)
    }
  }, [onOpenSource])

  const hasHistory = showHistory && history && history.length > 0

  return (
    <div style={{
      ...layoutPrimitives.fillColumn,
      background: colors.bgPrimary,
      flexDirection: 'row',
    }}>
      {/* History Sidebar */}
      {hasHistory && (
        <div style={{
          width: 260,
          minWidth: 260,
          borderRight: `1px solid ${colors.borderPrimary}`,
          background: colors.bgSecondary,
          overflow: 'auto',
          ...layoutPrimitives.column,
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.borderPrimary}`,
            fontSize: 12,
            fontWeight: 600,
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            History
          </div>
          <div style={{ padding: '8px 0', flex: 1, overflow: 'auto' }}>
            {history!.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 16px',
                  borderBottom: `1px solid ${colors.borderSecondary}`,
                  fontSize: 12,
                }}
              >
                <div style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  marginBottom: 4,
                  fontFamily: 'monospace',
                }}>
                  {entry.timestamp}
                </div>
                <div style={{ color: colors.textPrimary }}>
                  {entry.entry}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          ...layoutPrimitives.fill,
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onInit={(instance) => { reactFlowInstance.current = instance }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={4}
            panOnScroll
            panOnDrag
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            style={{ ...layoutPrimitives.fill }}
          >
            <Background color={colors.borderPrimary} gap={20} />
            <Controls
              style={{ background: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}` }}
              className="ws-themed-controls"
            />
            <style>{`
              .ws-themed-controls .react-flow__controls-button {
                background: ${colors.buttonBg} !important;
                border-color: ${colors.borderSecondary} !important;
                fill: ${colors.textPrimary} !important;
              }
              .ws-themed-controls .react-flow__controls-button:hover {
                background: ${colors.buttonBgHover} !important;
              }
              .ws-themed-controls .react-flow__controls-button svg {
                fill: ${colors.textPrimary} !important;
              }
            `}</style>
            <MiniMap
              style={{ background: colors.bgPrimary, border: `1px solid ${colors.borderPrimary}` }}
              nodeColor={() => colors.accent}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            ...layoutPrimitives.row,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              color: colors.textMuted,
              fontSize: 14,
              textAlign: 'center',
            }}>
              No diagrams or tasks to display.
              <br />
              <span style={{ fontSize: 12 }}>
                Pass markdown content with mermaid diagrams or task blocks.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
