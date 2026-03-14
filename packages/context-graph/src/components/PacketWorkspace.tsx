// ============================================================================
// PacketWorkspace — Visual packet canvas with section-aware layout
//
// Renders a context packet's diagrams, nodes, vectors, and metadata as an
// interactive workspace. Understands the new packet section structure:
// Whiteboard, Problem Vectors, AICCL, Delta Log, Linked.
//
// Usage: import { PacketWorkspace } from '@context-towel/context-graph/embed'
// ============================================================================

import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
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
import { parseNodes } from '../plugins/node/parser'
import {
  parsePacketSections,
  parseProblemVectors,
  parseDeltaLog,
  type PacketSection,
  type ProblemVectorEntry,
  type DeltaLogEntry,
} from './packet/parsePacketContent'

// Re-export types for consumers that imported them from here
export type { ProblemVectorEntry, DeltaLogEntry, PacketSection }

// ── Types ────────────────────────────────────────────────────────

export interface SessionLogEntry {
  timestamp: string
  entry: string
}

export interface PacketWorkspaceProps {
  /** The packet markdown content */
  packetContent: string
  /** Display name of the packet */
  packetName: string
  /** File path (for AI reference / source links) */
  packetPath: string
  /** Parsed session log entries */
  history?: SessionLogEntry[]
  /** Callback when user clicks a source reference */
  onOpenSource?: (file: string, line?: number) => void
  /** Callback when content should be saved (future inline editing) */
  onSave?: (content: string) => void
  /** Whether the workspace is currently visible (for performance) */
  isVisible?: boolean
}

// ── Section-Aware Layout ─────────────────────────────────────────

interface SectionNode {
  type: 'diagram' | 'task' | 'node'
  sectionName: string
  data: Record<string, unknown>
  width: number
  height: number
}

function buildSectionLayout(
  _packetContent: string,
  packetPath: string,
  sections: PacketSection[],
  onOpenSource?: (file: string, line?: number) => void,
): Node[] {
  // New section categories
  const whiteboardSections = ['Whiteboard']
  const aiccSectionName = 'AICCL'
  const vectorsSectionName = 'Problem Vectors'
  const deltaLogSectionName = 'Delta Log'
  // Also support legacy section names
  const diagramSections = ['Architecture', 'Data Model', ...whiteboardSections]

  const sectionNodes: SectionNode[] = []

  for (const section of sections) {
    // Whiteboard / diagram sections — parse mermaid diagrams
    if (diagramSections.includes(section.name)) {
      const result = parseDiagrams(section.content, packetPath)
      for (const diagram of result.items) {
        sectionNodes.push({
          type: 'diagram',
          sectionName: section.name,
          data: {
            diagram: { ...diagram, title: diagram.title || section.name },
            parentDocId: packetPath,
            sourceFile: packetPath,
            sourceLine: section.startLine + (diagram.sourceLine ?? 0),
            onOpenSource,
          },
          width: 600,
          height: 450,
        })
      }
    }

    // AICCL section — parse ~~~node blocks
    if (section.name === aiccSectionName) {
      const nodeResult = parseNodes(section.content, packetPath)
      for (const nodeItem of nodeResult.items) {
        sectionNodes.push({
          type: 'node',
          sectionName: section.name,
          data: {
            node: { ...nodeItem, sourceLine: section.startLine + (nodeItem.sourceLine ?? 0) },
            parentDocId: packetPath,
            sourceFile: packetPath,
            sourceLine: section.startLine + (nodeItem.sourceLine ?? 0),
            onOpenSource,
          },
          width: 400,
          height: 250,
        })
      }
      // Also parse diagrams from AICCL (may contain inline mermaid)
      const diagramResult = parseDiagrams(section.content, packetPath)
      for (const diagram of diagramResult.items) {
        sectionNodes.push({
          type: 'diagram',
          sectionName: section.name,
          data: {
            diagram: { ...diagram, title: diagram.title || section.name },
            parentDocId: packetPath,
            sourceFile: packetPath,
            sourceLine: section.startLine + (diagram.sourceLine ?? 0),
            onOpenSource,
          },
          width: 600,
          height: 450,
        })
      }
    }

    // Legacy: Active Tasks section
    if (section.name === 'Active Tasks') {
      const result = parseTasks(section.content, packetPath)
      for (const task of result.items) {
        sectionNodes.push({
          type: 'task',
          sectionName: section.name,
          data: {
            task,
            parentDocId: packetPath,
            sourceFile: packetPath,
            sourceLine: section.startLine + (task.sourceLine ?? 0),
            onOpenSource,
          },
          width: 350,
          height: 200,
        })
      }
    }
  }

  // Parse diagrams & nodes from any sections not yet handled
  const handledSections = new Set([
    ...diagramSections, aiccSectionName, vectorsSectionName,
    deltaLogSectionName, 'Active Tasks', 'Linked',
  ])

  for (const section of sections) {
    if (handledSections.has(section.name)) continue

    // Try diagrams
    const diagramResult = parseDiagrams(section.content, packetPath)
    for (const diagram of diagramResult.items) {
      sectionNodes.push({
        type: 'diagram',
        sectionName: section.name,
        data: {
          diagram: { ...diagram, title: diagram.title || section.name },
          parentDocId: packetPath,
          sourceFile: packetPath,
          sourceLine: section.startLine + (diagram.sourceLine ?? 0),
          onOpenSource,
        },
        width: 600,
        height: 450,
      })
    }

    // Try nodes
    const nodeResult = parseNodes(section.content, packetPath)
    for (const nodeItem of nodeResult.items) {
      sectionNodes.push({
        type: 'node',
        sectionName: section.name,
        data: {
          node: { ...nodeItem, sourceLine: section.startLine + (nodeItem.sourceLine ?? 0) },
          parentDocId: packetPath,
          sourceFile: packetPath,
          sourceLine: section.startLine + (nodeItem.sourceLine ?? 0),
          onOpenSource,
        },
        width: 400,
        height: 250,
      })
    }
  }

  // Group by section name
  const groups = new Map<string, SectionNode[]>()
  for (const n of sectionNodes) {
    const group = groups.get(n.sectionName) ?? []
    group.push(n)
    groups.set(n.sectionName, group)
  }

  // Layout: each section is a column
  const PADDING = 40
  const COL_WIDTH = 650
  const HEADER_HEIGHT = 36
  const nodes: Node[] = []
  let colIndex = 0

  // Order: Whiteboard first, then AICCL, then Problem Vectors content, then others
  const preferredOrder = [
    ...whiteboardSections.filter(s => groups.has(s)),
    // Legacy diagram sections
    ...['Architecture', 'Data Model'].filter(s => groups.has(s) && !whiteboardSections.includes(s)),
    ...(groups.has(aiccSectionName) ? [aiccSectionName] : []),
    ...(groups.has('Active Tasks') ? ['Active Tasks'] : []),
    ...Array.from(groups.keys()).filter(
      s => !diagramSections.includes(s) && s !== aiccSectionName && s !== 'Active Tasks',
    ),
  ]

  for (const sectionName of preferredOrder) {
    const items = groups.get(sectionName)
    if (!items?.length) continue

    const colX = PADDING + colIndex * (COL_WIDTH + PADDING)
    let y = PADDING + HEADER_HEIGHT

    // Add section label node
    nodes.push({
      id: `section-label-${sectionName}`,
      type: 'default',
      position: { x: colX, y: PADDING },
      data: { label: sectionName },
      style: {
        background: 'transparent',
        border: 'none',
        fontSize: 14,
        fontWeight: 700,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        pointerEvents: 'none' as const,
        padding: '4px 0',
        width: COL_WIDTH,
      },
      selectable: false,
      draggable: false,
    })

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const id = `pw-${sectionName.toLowerCase().replace(/\s+/g, '-')}-${item.type}-${i}`
      const estimatedHeight = item.type === 'diagram' ? 450 : item.type === 'node' ? 250 : 200

      nodes.push({
        id,
        type: item.type,
        position: { x: colX, y },
        data: item.data,
      })

      y += estimatedHeight + PADDING
    }

    colIndex++
  }

  return nodes
}

// ── Problem Vectors Header ───────────────────────────────────────

function ProblemVectorsHeader({
  vectors,
  packetName,
}: {
  vectors: ProblemVectorEntry[]
  packetName: string
}) {
  const { colors } = useTheme()

  if (vectors.length === 0) return null

  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
        background: colors.bgSecondary,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: colors.textPrimary,
        }}
      >
        {packetName}
      </div>
      {vectors.map((v) => (
        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <span style={{
              fontFamily: 'monospace',
              fontWeight: 600,
              color: colors.textPrimary,
            }}>
              {v.id}
            </span>
            <span style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 3,
              background: v.state === 'resolved' ? '#22c55e22' : '#3b82f622',
              color: v.state === 'resolved' ? '#22c55e' : '#3b82f6',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              {v.state}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
            <span>
              <span style={{ color: colors.textMuted, fontWeight: 600 }}>Current: </span>
              <span style={{ color: colors.textSecondary }}>{v.current}</span>
            </span>
            <span style={{ color: colors.textMuted }}>{'\u2192'}</span>
            <span>
              <span style={{ color: colors.textMuted, fontWeight: 600 }}>Target: </span>
              <span style={{ color: colors.textSecondary }}>{v.target}</span>
            </span>
          </div>
          {v.approach && (
            <div style={{ fontSize: 11, color: colors.textMuted }}>
              <span style={{ fontWeight: 600 }}>Approach: </span>
              {v.approach}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Delta Log Footer ─────────────────────────────────────────────

function DeltaLogFooter({ entries }: { entries: DeltaLogEntry[] }) {
  const { colors } = useTheme()
  if (entries.length === 0) return null

  // Show summary: count by type
  const typeCounts = new Map<string, number>()
  for (const e of entries) {
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1)
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.borderPrimary}`,
        background: colors.bgSecondary,
        padding: '10px 20px',
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        fontSize: 11,
      }}
    >
      <div>
        <span style={{ color: colors.textMuted, fontWeight: 600 }}>Delta Log: </span>
        <span style={{ color: colors.textSecondary }}>
          {entries.length} entries
        </span>
      </div>
      {Array.from(typeCounts.entries()).map(([type, count]) => (
        <span key={type} style={{ color: colors.textMuted }}>
          {type}: {count}
        </span>
      ))}
      {entries.length > 0 && (
        <span style={{ color: colors.textMuted, fontStyle: 'italic' }}>
          Latest: {entries[entries.length - 1].content.slice(0, 60)}
          {entries[entries.length - 1].content.length > 60 ? '...' : ''}
        </span>
      )}
    </div>
  )
}

// ── Delta Log Sidebar ────────────────────────────────────────────

function DeltaLogSidebar({ entries }: { entries: DeltaLogEntry[] }) {
  const { colors } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  if (entries.length === 0) return null

  const toSessionLogFormat: SessionLogEntry[] = entries.map(e => ({
    timestamp: e.timestamp,
    entry: `${e.type !== 'log' ? `(${e.type}) ` : ''}${e.nodeId ? `[${e.nodeId}] ` : ''}${e.content}`,
  }))

  return (
    <div
      style={{
        width: collapsed ? 40 : 260,
        minWidth: collapsed ? 40 : 260,
        transition: 'width 150ms, min-width 150ms',
        borderRight: `1px solid ${colors.borderPrimary}`,
        background: colors.bgSecondary,
        overflow: 'hidden',
        ...layoutPrimitives.column,
      }}
    >
      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          borderBottom: `1px solid ${colors.borderPrimary}`,
          fontSize: 12,
          fontWeight: 600,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        {!collapsed && 'Delta Log'}
        <span style={{ fontSize: 10 }}>{collapsed ? '\u25B6' : '\u25C0'}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 0', flex: 1, overflow: 'auto' }}>
          {toSessionLogFormat.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '8px 16px',
                borderBottom: `1px solid ${colors.borderSecondary}`,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  marginBottom: 4,
                  fontFamily: 'monospace',
                }}
              >
                {entry.timestamp}
              </div>
              <div style={{ color: colors.textPrimary }}>{entry.entry}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export function PacketWorkspace({
  packetContent,
  packetName,
  packetPath,
  history: externalHistory,
  onOpenSource,
  onSave: _onSave,
  isVisible = true,
}: PacketWorkspaceProps) {
  const { colors } = useTheme()
  useMermaidTheme()

  const reactFlowInstance = useRef<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Parse packet sections
  const sections = useMemo(() => parsePacketSections(packetContent), [packetContent])
  const problemVectors = useMemo(() => parseProblemVectors(sections), [sections])
  const deltaLogEntries = useMemo(() => parseDeltaLog(sections), [sections])

  // Build sidebar entries from external history or delta log
  const sidebarEntries = useMemo(() => {
    if (externalHistory) return externalHistory.map(e => ({
      timestamp: e.timestamp,
      type: 'log',
      content: e.entry,
    } as DeltaLogEntry))
    return deltaLogEntries
  }, [externalHistory, deltaLogEntries])

  // Build section-aware layout
  useEffect(() => {
    if (!isVisible) return

    const layoutedNodes = buildSectionLayout(
      packetContent,
      packetPath,
      sections,
      onOpenSource,
    )

    setNodes(layoutedNodes)
    setEdges([])

    // Fit view after nodes render
    setTimeout(() => {
      reactFlowInstance.current?.fitView({ padding: 0.15, duration: 200 })
    }, 100)
  }, [packetContent, packetPath, sections, isVisible, onOpenSource, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const data = node.data as Record<string, unknown>
      if (onOpenSource && data.sourceFile) {
        onOpenSource(data.sourceFile as string, data.sourceLine as number | undefined)
      }
    },
    [onOpenSource],
  )

  return (
    <div
      style={{
        ...layoutPrimitives.fillColumn,
        background: colors.bgPrimary,
      }}
    >
      {/* Problem Vectors Header */}
      <ProblemVectorsHeader vectors={problemVectors} packetName={packetName} />

      {/* Main content area */}
      <div
        style={{
          ...layoutPrimitives.fillRow,
        }}
      >
        {/* Delta Log Sidebar */}
        <DeltaLogSidebar entries={sidebarEntries} />

        {/* Canvas */}
        <div
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
              onInit={(instance) => {
                reactFlowInstance.current = instance
              }}
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
                style={{
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.borderPrimary}`,
                }}
                className="pw-themed-controls"
              />
              <style>{`
                .pw-themed-controls .react-flow__controls-button {
                  background: ${colors.buttonBg} !important;
                  border-color: ${colors.borderSecondary} !important;
                  fill: ${colors.textPrimary} !important;
                }
                .pw-themed-controls .react-flow__controls-button:hover {
                  background: ${colors.buttonBgHover} !important;
                }
                .pw-themed-controls .react-flow__controls-button svg {
                  fill: ${colors.textPrimary} !important;
                }
              `}</style>
              <MiniMap
                style={{
                  background: colors.bgPrimary,
                  border: `1px solid ${colors.borderPrimary}`,
                }}
                nodeColor={() => colors.accent}
                pannable
                zoomable
              />
            </ReactFlow>
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                ...layoutPrimitives.row,
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  color: colors.textMuted,
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                No content in packet yet.
                <br />
                <span style={{ fontSize: 12 }}>
                  Add mermaid diagrams to Whiteboard sections, or ~~~node blocks to AICCL.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delta Log Footer */}
      <DeltaLogFooter entries={deltaLogEntries} />
    </div>
  )
}
