// ============================================================================
// PacketWorkspace — Visual packet canvas with section-aware layout
//
// Renders a context packet's diagrams, tasks, and metadata as an interactive
// workspace. Unlike WorkspaceBoard (generic markdown→canvas), PacketWorkspace
// is packet-aware — it understands the section structure and groups content
// by section (Architecture, Data Model, Active Tasks, etc.).
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

// ── Packet Section Parsing ───────────────────────────────────────

interface PacketSection {
  name: string
  content: string
  startLine: number
}

interface ProblemVectorData {
  current: string
  target: string
  approach: string
}

interface PatternEntry {
  name: string
  description: string
}

interface PivotEntry {
  name: string
  reason: string
}

function parsePacketSections(markdown: string): PacketSection[] {
  const sections: PacketSection[] = []
  const lines = markdown.split('\n')
  let currentSection: PacketSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        name: h2Match[1].trim(),
        content: '',
        startLine: i + 1,
      }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }
  }
  if (currentSection) {
    sections.push(currentSection)
  }
  return sections
}

function parseProblemVector(sections: PacketSection[]): ProblemVectorData | null {
  const section = sections.find(s => s.name === 'Problem Vector')
  if (!section) return null

  const currentMatch = section.content.match(/\*\*Current:\*\*\s*(.+)/)
  const targetMatch = section.content.match(/\*\*Target:\*\*\s*(.+)/)
  const approachMatch = section.content.match(/\*\*Approach:\*\*\s*(.+)/)

  const current = currentMatch?.[1]?.trim() ?? ''
  const target = targetMatch?.[1]?.trim() ?? ''
  const approach = approachMatch?.[1]?.trim() ?? ''

  if (!current && !target && !approach) return null
  return { current, target, approach }
}

function parsePatterns(sections: PacketSection[]): PatternEntry[] {
  const section = sections.find(s => s.name === 'Patterns Applied')
  if (!section) return []

  const patterns: PatternEntry[] = []
  const regex = /- \*\*([^*]+)\*\*\s*(?:—|–|-)\s*(.+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(section.content)) !== null) {
    patterns.push({ name: match[1].trim(), description: match[2].trim() })
  }
  return patterns
}

function parsePivots(sections: PacketSection[]): PivotEntry[] {
  const section = sections.find(s => s.name === 'Tried & Pivoted')
  if (!section) return []

  const pivots: PivotEntry[] = []
  const regex = /- \*\*([^*]+)\*\*\s*(?:—|–|-)\s*(.+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(section.content)) !== null) {
    pivots.push({ name: match[1].trim(), reason: match[2].trim() })
  }
  return pivots
}

function parseSessionLog(sections: PacketSection[]): SessionLogEntry[] {
  const section = sections.find(s => s.name === 'Session Log')
  if (!section) return []

  const entries: SessionLogEntry[] = []
  const regex = /- \[([^\]]+)\]\s*(.+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(section.content)) !== null) {
    entries.push({ timestamp: match[1].trim(), entry: match[2].trim() })
  }
  return entries
}

// ── Section-Aware Layout ─────────────────────────────────────────

interface SectionNode {
  type: 'diagram' | 'task'
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
  // Categorize sections into columns
  const diagramSections = ['Architecture', 'Data Model']
  const taskSectionName = 'Active Tasks'

  // Parse diagrams from diagram sections
  const sectionNodes: SectionNode[] = []

  for (const section of sections) {
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

    if (section.name === taskSectionName) {
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

  // Also parse any diagrams from sections not in the known list
  // (user might add custom diagram sections)
  for (const section of sections) {
    if (!diagramSections.includes(section.name) && section.name !== taskSectionName) {
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
  }

  // Group by section name
  const groups = new Map<string, SectionNode[]>()
  for (const node of sectionNodes) {
    const group = groups.get(node.sectionName) ?? []
    group.push(node)
    groups.set(node.sectionName, group)
  }

  // Layout: each section is a column
  const PADDING = 40
  const COL_WIDTH = 650
  const HEADER_HEIGHT = 36
  const nodes: Node[] = []
  let colIndex = 0

  // Order: Architecture first, then Data Model, then Active Tasks, then others
  const orderedSections = [
    ...diagramSections.filter(s => groups.has(s)),
    ...(groups.has(taskSectionName) ? [taskSectionName] : []),
    ...Array.from(groups.keys()).filter(
      s => !diagramSections.includes(s) && s !== taskSectionName,
    ),
  ]

  for (const sectionName of orderedSections) {
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
      const estimatedHeight = item.type === 'diagram' ? 450 : 200

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

// ── Problem Vector Header ────────────────────────────────────────

function ProblemVectorHeader({
  vector,
  packetName,
}: {
  vector: ProblemVectorData
  packetName: string
}) {
  const { colors } = useTheme()

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
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
        <span>
          <span style={{ color: colors.textMuted, fontWeight: 600 }}>Current: </span>
          <span style={{ color: colors.textSecondary }}>{vector.current}</span>
        </span>
        <span style={{ color: colors.textMuted }}>→</span>
        <span>
          <span style={{ color: colors.textMuted, fontWeight: 600 }}>Target: </span>
          <span style={{ color: colors.textSecondary }}>{vector.target}</span>
        </span>
      </div>
      {vector.approach && (
        <div style={{ fontSize: 11, color: colors.textMuted }}>
          <span style={{ fontWeight: 600 }}>Approach: </span>
          {vector.approach}
        </div>
      )}
    </div>
  )
}

// ── Patterns & Pivots Footer ─────────────────────────────────────

function MetadataFooter({
  patterns,
  pivots,
}: {
  patterns: PatternEntry[]
  pivots: PivotEntry[]
}) {
  const { colors } = useTheme()
  if (patterns.length === 0 && pivots.length === 0) return null

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
      {patterns.length > 0 && (
        <div>
          <span style={{ color: colors.textMuted, fontWeight: 600 }}>Patterns: </span>
          {patterns.map((p, i) => (
            <span key={p.name} style={{ color: colors.textSecondary }}>
              {i > 0 && ' · '}
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              {p.description && (
                <span style={{ color: colors.textMuted }}> ({p.description})</span>
              )}
            </span>
          ))}
        </div>
      )}
      {pivots.length > 0 && (
        <div>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>Pivoted: </span>
          {pivots.map((p, i) => (
            <span key={p.name} style={{ color: colors.textMuted }}>
              {i > 0 && ' · '}
              <s>{p.name}</s>
              {p.reason && ` (${p.reason})`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Session Log Sidebar ──────────────────────────────────────────

function SessionLogSidebar({ entries }: { entries: SessionLogEntry[] }) {
  const { colors } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  if (entries.length === 0) return null

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
        {!collapsed && 'Session Log'}
        <span style={{ fontSize: 10 }}>{collapsed ? '▶' : '◀'}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 0', flex: 1, overflow: 'auto' }}>
          {entries.map((entry, i) => (
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
  const problemVector = useMemo(() => parseProblemVector(sections), [sections])
  const patterns = useMemo(() => parsePatterns(sections), [sections])
  const pivots = useMemo(() => parsePivots(sections), [sections])
  const sessionLog = useMemo(
    () => externalHistory ?? parseSessionLog(sections),
    [externalHistory, sections],
  )

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
      {/* Problem Vector Header */}
      {problemVector && (
        <ProblemVectorHeader vector={problemVector} packetName={packetName} />
      )}

      {/* Main content area */}
      <div
        style={{
          ...layoutPrimitives.fillRow,
        }}
      >
        {/* Session Log Sidebar */}
        <SessionLogSidebar entries={sessionLog} />

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
                No diagrams or tasks in packet yet.
                <br />
                <span style={{ fontSize: 12 }}>
                  Add mermaid diagrams to Architecture/Data Model sections, or tasks to
                  Active Tasks.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Patterns & Pivots Footer */}
      <MetadataFooter patterns={patterns} pivots={pivots} />
    </div>
  )
}
