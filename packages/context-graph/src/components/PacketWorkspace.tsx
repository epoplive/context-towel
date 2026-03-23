// ============================================================================
// PacketWorkspace — Dashboard canvas for packet content
//
// Shows the human-facing view of what the agent knows:
//   - Problem card (current state + approach + facts + diagrams)
//   - Target card (what done looks like + acceptance criteria)
//   - Delta timeline (recent discoveries and evidence)
//
// This is NOT the AICCL view. AICCL is the compressed format injected
// into the agent's context window. This board shows the same information
// rendered for human review.
// ============================================================================

import { useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes, edgeTypes } from './FlowNodes'
import { useTheme, useMermaidTheme } from '../compat/design-system'
import { layoutPrimitives } from '../compat/layoutPrimitives'
import { parseDiagrams } from '../plugins/diagram/parser'
import {
  parsePacketSections,
  parseProblemVectors,
  parseDeltaLog,
  type PacketSection,
  type ProblemVectorEntry,
  type DeltaLogEntry,
} from './packet/parsePacketContent'
import type { VectorProgress } from './packet/VectorNode'

export type { ProblemVectorEntry, DeltaLogEntry, PacketSection }

// ── Types ────────────────────────────────────────────────────────

export interface SessionLogEntry {
  timestamp: string
  entry: string
}

export interface PacketWorkspaceProps {
  packetContent: string
  packetName: string
  packetPath: string
  history?: SessionLogEntry[]
  onOpenSource?: (file: string, line?: number) => void
  onSave?: (content: string) => void
  isVisible?: boolean
}

// ── Mermaid preprocessing ────────────────────────────────────────

/**
 * Mermaid interprets [/text/] and [\text\] as shape delimiters.
 * Node labels containing / or \ at the start get misread as shapes.
 * Quote any unquoted labels that contain special chars.
 */
function sanitizeMermaidLabels(code: string): string {
  // Match node labels: WORD[...] where content isn't already quoted
  // and contains chars that mermaid treats as shape syntax (/ \ *)
  return code.replace(
    /(\w+)\[([^\]"]+)\]/g,
    (_match, nodeId: string, label: string) => {
      if (/[/\\*<>]/.test(label)) {
        return `${nodeId}["${label}"]`
      }
      return _match
    },
  )
}

function expandMermaidCode(code: string): string {
  let expanded = code
  if (!(code.includes('\n') && code.split('\n').length > 2)) {
    expanded = code.replace(/;\s*/g, '\n')
  }
  return sanitizeMermaidLabels(expanded)
}

// ── Delta content extraction ─────────────────────────────────────

/** Delta log content is sometimes JSON — extract the human-readable part */
function readableDeltaContent(raw: string): string {
  if (!raw.startsWith('{')) return raw
  try {
    const parsed = JSON.parse(raw)
    // Engine format: {"content":"...", "layer":"...", ...}
    if (typeof parsed.content === 'string') return parsed.content
    // Collapse format: {"current":"...", "target":"...", ...}
    if (typeof parsed.current === 'string') return parsed.current
    return raw
  } catch {
    return raw
  }
}

// ── Architecture component extraction ────────────────────────────

/** Extract node labels from mermaid graph code for system impact matching */
function extractMermaidNodes(code: string): Array<{ id: string; label: string }> {
  const nodes: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()

  // Match: NodeId[Label] or NodeId["Label"] or NodeId(Label) or NodeId[(Label)]
  const patterns = [
    /(\w+)\["([^"]+)"\]/g,
    /(\w+)\[([^\]]+)\]/g,
    /(\w+)\(([^)]+)\)/g,
    /(\w+)\[\(([^)]+)\)\]/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code)) !== null) {
      const id = match[1]
      const label = match[2]
      if (!seen.has(id)) {
        seen.add(id)
        nodes.push({ id, label })
      }
    }
  }
  return nodes
}

/** Generate a focused mini mermaid diagram highlighting affected components */
function generateImpactDiagram(
  archCode: string,
  archNodes: Array<{ id: string; label: string }>,
  gapText: string,
): string | null {
  // Find which architecture components are mentioned in the gap text
  const textLower = gapText.toLowerCase()
  const affected = archNodes.filter(n =>
    textLower.includes(n.label.toLowerCase()) ||
    textLower.includes(n.id.toLowerCase()),
  )

  if (affected.length === 0) return null

  // Extract edges from the architecture that connect affected nodes
  const affectedIds = new Set(affected.map(n => n.id))
  const edges: string[] = []
  // Match: Source -->|label| Target or Source --> Target
  const edgePattern = /(\w+)\s*-->(?:\|([^|]*)\|)?\s*(\w+)/g
  let match: RegExpExecArray | null
  while ((match = edgePattern.exec(archCode)) !== null) {
    const src = match[1]
    const label = match[2] ?? ''
    const tgt = match[3]
    // Include edge if either end is affected
    if (affectedIds.has(src) || affectedIds.has(tgt)) {
      // Add both nodes to affected set for completeness
      affectedIds.add(src)
      affectedIds.add(tgt)
      if (label) {
        edges.push(`${src} -->|${label}| ${tgt}`)
      } else {
        edges.push(`${src} --> ${tgt}`)
      }
    }
  }

  if (edges.length === 0 && affected.length < 2) return null

  // Build focused diagram
  const lines = ['graph LR']

  // Add node definitions for affected nodes
  const allAffected = archNodes.filter(n => affectedIds.has(n.id))
  for (const n of allAffected) {
    lines.push(`  ${n.id}["${n.label}"]`)
  }

  // Add edges
  for (const e of edges) {
    lines.push(`  ${e}`)
  }

  // Style: directly affected nodes green (this gap's contribution to the target state),
  // neighboring/connected nodes dimmed (context for where it fits)
  const directIds = affected.map(n => n.id)
  const neighborIds = Array.from(affectedIds).filter(id => !directIds.includes(id))
  if (directIds.length > 0) {
    lines.push(`  style ${directIds.join(',')} fill:#22c55e22,stroke:#22c55e,stroke-width:2px,color:#22c55e`)
  }
  if (neighborIds.length > 0) {
    lines.push(`  style ${neighborIds.join(',')} fill:#1e293b44,stroke:#475569,stroke-width:1px`)
  }

  return lines.join('\n')
}

/** Generate target-state diagram — architecture with gap-affected nodes shown as resolved (green) */
function generateTargetDiagram(
  archCode: string,
  archNodes: Array<{ id: string; label: string }>,
  gapTexts: string[],
): string | null {
  if (archNodes.length === 0) return null

  // Find all nodes affected by ANY gap
  const allGapText = gapTexts.join(' ').toLowerCase()
  const affectedIds = new Set<string>()
  for (const n of archNodes) {
    if (allGapText.includes(n.label.toLowerCase()) || allGapText.includes(n.id.toLowerCase())) {
      affectedIds.add(n.id)
    }
  }

  if (affectedIds.size === 0) return null

  // Rebuild the full architecture diagram but restyle affected nodes green
  const lines = archCode.split('\n')
  const result: string[] = []

  for (const line of lines) {
    // Skip existing style lines — we'll add our own
    if (line.trim().startsWith('style ')) continue
    result.push(line)
  }

  // Style affected nodes green (target/resolved state)
  const affectedList = Array.from(affectedIds)
  if (affectedList.length > 0) {
    result.push(`  style ${affectedList.join(',')} fill:#22c55e22,stroke:#22c55e,stroke-width:2px,color:#22c55e`)
  }

  // Style unaffected nodes dim
  const unaffected = archNodes.filter(n => !affectedIds.has(n.id)).map(n => n.id)
  if (unaffected.length > 0) {
    result.push(`  style ${unaffected.join(',')} fill:#1e293b44,stroke:#475569,stroke-width:1px`)
  }

  return result.join('\n')
}

/** Extract file paths from delta content */
function extractFilePaths(content: string): string[] {
  const paths: string[] = []
  // Match common file path patterns
  const pathPattern = /(?:^|\s)((?:[\w.-]+\/)+[\w.-]+\.\w+)/g
  let match: RegExpExecArray | null
  while ((match = pathPattern.exec(content)) !== null) {
    const p = match[1]
    if (!paths.includes(p)) paths.push(p)
  }
  return paths
}

// ── Graph item types ─────────────────────────────────────────────

interface GraphCard {
  id: string
  type: string
  data: Record<string, unknown>
  width: number
  height: number
}

// ── Collect cards + derive edges ─────────────────────────────────

function buildGraph(
  packetPath: string,
  sections: PacketSection[],
  vectors: ProblemVectorEntry[],
  deltas: DeltaLogEntry[],
  _onOpenSource?: (file: string, line?: number) => void,
): { cards: GraphCard[]; edges: Edge[] } {
  const cards: GraphCard[] = []
  const edges: Edge[] = []

  // ── Collect whiteboard diagrams ──
  const embeddedDiagrams: import('./packet/VectorNode').EmbeddedDiagram[] = []
  const whiteboardSections = ['Whiteboard', 'Architecture', 'Data Model']
  for (const section of sections) {
    if (!whiteboardSections.includes(section.name)) continue
    const result = parseDiagrams(section.content, packetPath)
    for (const diagram of result.items) {
      embeddedDiagrams.push({
        title: diagram.title || section.name,
        code: expandMermaidCode(diagram.code),
      })
    }
  }

  // ── Extract architecture components for impact diagrams ──
  const archDiagram = embeddedDiagrams.find(d =>
    d.title.toLowerCase().includes('architecture') || d.title.toLowerCase() === 'whiteboard',
  )
  const archNodes = archDiagram ? extractMermaidNodes(archDiagram.code) : []
  const archCode = archDiagram?.code ?? ''

  // ── Tally per-vector progress from delta log success/failure counts ──
  const vectorProgress = new Map<string, VectorProgress>()
  for (const d of deltas) {
    // Count successes and failures from delta entries
    const isSuccess = d.type === 'success' || d.type === 'promotion'
    const isFailed = d.type === 'failure'
    const isActive = d.type === 'discovery'
    if (!isSuccess && !isFailed && !isActive) continue

    // Default to first vector
    const vectorId = vectors.length > 0 ? vectors[0].id : null
    if (!vectorId) continue

    if (!vectorProgress.has(vectorId)) {
      vectorProgress.set(vectorId, { active: 0, success: 0, failed: 0, total: 0 })
    }
    const p = vectorProgress.get(vectorId)!
    p.total++
    if (isActive) p.active++
    else if (isSuccess) p.success++
    else if (isFailed) p.failed++
  }

  for (const v of vectors) {
    const problemId = `problem-${v.id}`
    const targetId = `target-${v.id}`
    const progress = vectorProgress.get(v.id)

    // ── LEFT: Problem card — current state + approach + diagrams ──
    // (facts with mark=gap become middle cards, established facts stay here)
    const establishedFacts = v.problemFacts?.filter(f => f.mark === 'established')
    const gapFacts = v.problemFacts?.filter(f => f.mark === 'gap') ?? []
    const pendingCriteria = v.solvedCriteria?.filter(c => c.mark === 'pending') ?? []

    let problemHeight = 100
    if (v.current) problemHeight += Math.ceil(v.current.length / 50) * 16 + 20
    if (v.approach) problemHeight += Math.ceil(v.approach.length / 50) * 16 + 40
    if (establishedFacts && establishedFacts.length > 0) problemHeight += establishedFacts.length * 32 + 30
    if (embeddedDiagrams.length > 0) problemHeight += 200

    cards.push({
      id: problemId,
      type: 'vector',
      data: {
        vector: {
          ...v,
          // Only show established facts inline, gaps become separate cards
          problemFacts: establishedFacts && establishedFacts.length > 0 ? establishedFacts : undefined,
        },
        progress,
        mode: 'problem' as const,
        diagrams: embeddedDiagrams.length > 0 ? embeddedDiagrams : undefined,
      },
      width: 440,
      height: Math.max(problemHeight, 200),
    })

    // ── MIDDLE: Gap cards — unsolved problems that form the path ──
    // Each gap is a step that needs to happen between problem and target.
    // Gaps from problem facts + pending criteria = the work graph.
    // Proven criteria show as resolved (solid border, checkmark).
    const gapCards: Array<{ id: string; state: string }> = []

    // Also include proven criteria — they show as resolved gap cards
    const provenCriteria = v.solvedCriteria?.filter(c => c.mark === 'proven') ?? []

    // Pre-compute readable delta content for fuzzy matching + display
    const readableDeltas = deltas.map(d => ({
      ...d,
      content: readableDeltaContent(d.content),
    }))

    // Helper: build enriched gap card data with impact diagram + file paths
    function buildGapCard(
      cardId: string,
      text: string,
      label: string,
      related: typeof readableDeltas,
      state: string,
    ) {
      // Generate impact diagram from architecture
      const impactDiagram = archNodes.length > 0
        ? generateImpactDiagram(archCode, archNodes, text + ' ' + related.map(r => r.content).join(' '))
        : null

      // Extract file paths from evidence
      const allFilePaths: string[] = []
      for (const r of related) {
        for (const fp of extractFilePaths(r.content)) {
          if (!allFilePaths.includes(fp)) allFilePaths.push(fp)
        }
      }
      // Also check raw delta content for file paths
      for (const d of deltas) {
        const raw = d.content
        if (raw.includes('"content"')) {
          for (const fp of extractFilePaths(raw)) {
            if (!allFilePaths.includes(fp)) allFilePaths.push(fp)
          }
        }
      }

      // Find affected system names from architecture
      const textLower = (text + ' ' + related.map(r => r.content).join(' ')).toLowerCase()
      const affectedSystems = archNodes
        .filter(n => textLower.includes(n.label.toLowerCase()) || textLower.includes(n.id.toLowerCase()))
        .map(n => n.label)

      // Height: base + text + diagram + files + evidence
      let height = 90 + Math.ceil(text.length / 40) * 14
      if (impactDiagram) height += 180
      if (allFilePaths.length > 0) height += Math.min(allFilePaths.length, 5) * 18 + 30
      if (affectedSystems.length > 0) height += 30
      if (related.length > 0 && state !== 'resolved') height += Math.min(related.length, 2) * 50

      cards.push({
        id: cardId,
        type: 'gap',
        data: {
          text,
          label,
          state,
          relatedDeltas: related.length > 0 ? related : undefined,
          impactDiagram: impactDiagram ? expandMermaidCode(impactDiagram) : undefined,
          filePaths: allFilePaths.length > 0 ? allFilePaths : undefined,
          affectedSystems: affectedSystems.length > 0 ? affectedSystems : undefined,
        },
        width: impactDiagram ? 380 : 320,
        height,
      })
      gapCards.push({ id: cardId, state })
    }

    for (let i = 0; i < gapFacts.length; i++) {
      const gap = gapFacts[i]
      const cardId = `gap-${v.id}-${i}`
      const gapWords = gap.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const related = readableDeltas.filter(d =>
        gapWords.some(w => d.content.toLowerCase().includes(w)),
      )
      const gapState = related.some(d => d.type === 'success') ? 'resolved' : related.length > 0 ? 'in-progress' : 'open'
      buildGapCard(cardId, gap.text, 'Gap', related, gapState)
    }

    for (let i = 0; i < pendingCriteria.length; i++) {
      const crit = pendingCriteria[i]
      const cardId = `pending-${v.id}-${i}`
      const critWords = crit.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const related = readableDeltas.filter(d =>
        critWords.some(w => d.content.toLowerCase().includes(w)),
      )
      const critState = related.some(d => d.type === 'success') ? 'resolved' : related.length > 0 ? 'in-progress' : 'open'
      buildGapCard(cardId, crit.text, 'Pending', related, critState)
    }

    // Proven criteria become resolved gap cards
    for (let i = 0; i < provenCriteria.length; i++) {
      const crit = provenCriteria[i]
      const cardId = `proven-${v.id}-${i}`

      cards.push({
        id: cardId,
        type: 'gap',
        data: {
          text: crit.text,
          label: 'Proven',
          state: 'resolved',
        },
        width: 300,
        height: 70 + Math.ceil(crit.text.length / 40) * 14,
      })
      gapCards.push({ id: cardId, state: 'resolved' })
    }

    // ── RIGHT: Target card — what done looks like with target-state diagram ──
    // Shows the architecture as it SHOULD look when all gaps are resolved.
    // Affected components styled green (done), unaffected dimmed.
    const allGapTexts = [
      ...gapFacts.map(g => g.text),
      ...pendingCriteria.map(c => c.text),
    ]
    const targetDiagram = generateTargetDiagram(archCode, archNodes, allGapTexts)
    const targetDiagrams: import('./packet/VectorNode').EmbeddedDiagram[] = targetDiagram
      ? [{ title: 'Target Architecture', code: expandMermaidCode(targetDiagram) }]
      : []

    let targetHeight = 100
    if (v.target) targetHeight += Math.ceil(v.target.length / 50) * 16 + 20
    if (v.solvedCriteria) targetHeight += v.solvedCriteria.length * 28 + 50
    if (targetDiagrams.length > 0) targetHeight += 200

    cards.push({
      id: targetId,
      type: 'vector',
      data: {
        vector: v,
        mode: 'target' as const,
        diagrams: targetDiagrams.length > 0 ? targetDiagrams : undefined,
      },
      width: 440,
      height: Math.max(targetHeight, 200),
    })

    // ── Build the graph edges ──
    // Resolved steps are BEHIND the current state — they already happened
    // and brought us to where we are now. Open/in-progress are ahead.
    //
    //   resolved₁ → resolved₂ → PROBLEM → in-progress → open → TARGET
    //
    // This models the trajectory: resolved steps shifted our heading,
    // the problem card is where we ARE, future steps bend us toward target.

    // Split into before (resolved) and after (in-progress, open) the current state
    const resolvedGaps = gapCards.filter(g => g.state === 'resolved')
    const futureGaps = gapCards.filter(g => g.state !== 'resolved')
    // Sort future: in-progress first, then open
    futureGaps.sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, open: 1 }
      return (order[a.state] ?? 1) - (order[b.state] ?? 1)
    })

    if (gapCards.length === 0) {
      edges.push({
        id: `e-${problemId}-${targetId}`,
        source: problemId,
        target: targetId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'floating',
        animated: v.state === 'active',
        style: {
          stroke: v.state === 'active' ? '#3b82f6' : '#22c55e',
          strokeWidth: 3,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      })
    } else {
      // Chain: resolved₁ → resolved₂ → PROBLEM → future₁ → future₂ → TARGET
      const fullChain = [
        ...resolvedGaps.map(g => ({ id: g.id, state: g.state })),
        { id: problemId, state: 'current' },
        ...futureGaps.map(g => ({ id: g.id, state: g.state })),
        { id: targetId, state: 'target' },
      ]

      for (let i = 0; i < fullChain.length - 1; i++) {
        const src = fullChain[i]
        const tgt = fullChain[i + 1]
        const isResolved = src.state === 'resolved'
        const isActive = src.state === 'in-progress' || tgt.state === 'in-progress'
        const isFuture = src.state === 'open' || tgt.state === 'open'
        const edgeColor = isResolved ? '#22c55e' : isActive ? '#3b82f6' : isFuture ? '#f59e0b' : '#94a3b8'

        edges.push({
          id: `e-${src.id}-${tgt.id}`,
          source: src.id,
          target: tgt.id,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'floating',
          animated: isActive,
          style: {
            stroke: edgeColor,
            strokeWidth: isResolved ? 3 : 2,
            strokeDasharray: isResolved ? undefined : '6 3',
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        })
      }
    }
  }

  // ── Delta timeline — below the graph ──
  if (deltas.length > 0) {
    const cardId = 'delta-timeline'
    const parentId = vectors.length > 0 ? `problem-${vectors[0].id}` : null
    cards.push({
      id: cardId,
      type: 'delta-timeline',
      data: { entries: deltas },
      width: 480,
      height: Math.min(60 + deltas.length * 70, 600),
    })
    if (parentId) {
      edges.push({
        id: `e-${parentId}-${cardId}`,
        source: parentId,
        target: cardId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'floating',
        style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 4' },
      })
    }
  }

  return { cards, edges }
}

// ── Layout: Trajectory chain positioning ─────────────────────────
//
//     [resolved 1]  (history — already shifted heading)
//         ↓
//     [resolved 2]
//         ↓
//   [PROBLEM]  ← current state (we are here)
//         ↓
//     [in-progress]  (active work)
//         ↓
//     [open]  (future work)
//         ↓
//   [TARGET]  ← what done looks like
//
//              [Timeline]
//
// Resolved steps drift LEFT (coming from the past).
// Future steps drift RIGHT (heading toward the target).
// This creates a visual bend at the problem card.

function computeLayout(
  cards: GraphCard[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const STEP_GAP_Y = 40
  const STEP_DRIFT_X = 40

  const problemCard = cards.find(c => c.id.startsWith('problem-'))
  const targetCard = cards.find(c => c.id.startsWith('target-'))
  const gapCards = cards.filter(c => c.type === 'gap')
  const timeline = cards.find(c => c.type === 'delta-timeline')

  // Split and sort same as edge building
  const resolved = gapCards.filter(c => (c.data as Record<string, unknown>).state === 'resolved')
  const future = gapCards
    .filter(c => (c.data as Record<string, unknown>).state !== 'resolved')
    .sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, open: 1 }
      const aS = (a.data as Record<string, unknown>).state as string
      const bS = (b.data as Record<string, unknown>).state as string
      return (order[aS] ?? 1) - (order[bS] ?? 1)
    })

  const problemW = problemCard?.width ?? 440

  // ── Resolved steps above problem, drifting left (coming from past) ──
  // Build from problem upward, then flip
  const resolvedPositions: Array<{ id: string; x: number; y: number }> = []
  let resolvedHeight = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    const card = resolved[i]
    resolvedHeight += card.height + STEP_GAP_Y
    resolvedPositions.unshift({
      id: card.id,
      x: (problemW - card.width) / 2 - (resolved.length - 1 - i) * STEP_DRIFT_X,
      y: 0, // placeholder, offset below
    })
  }

  // Position resolved cards above the problem
  let offsetY = 0
  for (const rp of resolvedPositions) {
    const card = resolved.find(c => c.id === rp.id)!
    positions.set(rp.id, { x: rp.x, y: offsetY })
    offsetY += card.height + STEP_GAP_Y
  }

  // ── Problem card ──
  const problemY = offsetY
  if (problemCard) {
    positions.set(problemCard.id, { x: 0, y: problemY })
    offsetY += (problemCard.height ?? 200) + STEP_GAP_Y
  }

  // ── Future steps below problem, drifting right (heading toward target) ──
  let futureX = (problemW - (future[0]?.width ?? 300)) / 2
  for (const card of future) {
    positions.set(card.id, { x: futureX, y: offsetY })
    offsetY += card.height + STEP_GAP_Y
    futureX += STEP_DRIFT_X
  }

  // ── Target card at end ──
  if (targetCard) {
    if (gapCards.length > 0) {
      positions.set(targetCard.id, { x: futureX + STEP_DRIFT_X, y: offsetY })
      offsetY += (targetCard.height ?? 160) + STEP_GAP_Y
    } else {
      positions.set(targetCard.id, { x: problemW + 140, y: problemY })
    }
  }

  // ── Delta timeline below everything, centered ──
  if (timeline) {
    const allPositioned = [...positions.entries()]
    const maxX = Math.max(...allPositioned.map(([, p]) => p.x)) + 400
    const centerX = maxX / 2 - timeline.width / 2
    positions.set(timeline.id, { x: Math.max(0, centerX), y: offsetY + 40 })
  }

  return positions
}

// ── Main Component ───────────────────────────────────────────────

export function PacketWorkspace({
  packetContent,
  packetName: _packetName,
  packetPath,
  history: externalHistory,
  onOpenSource,
  onSave: _onSave,
  isVisible = true,
}: PacketWorkspaceProps) {
  const { colors } = useTheme()
  useMermaidTheme()

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Track user-positioned nodes so content updates don't blow away drags
  const userPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  const sections = useMemo(() => parsePacketSections(packetContent), [packetContent])
  const problemVectors = useMemo(() => parseProblemVectors(sections), [sections])
  const deltaLogEntries = useMemo(() => {
    if (externalHistory) {
      return externalHistory.map(e => ({
        timestamp: e.timestamp,
        type: 'log',
        content: e.entry,
      } as DeltaLogEntry))
    }
    return parseDeltaLog(sections)
  }, [externalHistory, sections])

  // Build the dashboard graph (cards + edges)
  const { cards: allCards, edges: allEdges } = useMemo(
    () => buildGraph(packetPath, sections, problemVectors, deltaLogEntries, onOpenSource),
    [packetPath, sections, problemVectors, deltaLogEntries, onOpenSource],
  )

  // Sync to ReactFlow
  useEffect(() => {
    if (!isVisible) return

    const positions = computeLayout(allCards)
    const isFirstLayout = userPositions.current.size === 0

    const flowNodes: Node[] = allCards.map(card => ({
      id: card.id,
      type: card.type,
      position: userPositions.current.get(card.id) ?? positions.get(card.id) ?? { x: 0, y: 0 },
      data: card.data,
    }))

    setNodes(flowNodes)
    setEdges(allEdges)

    if (isFirstLayout) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.15, duration: 300 })
      }, 100)
    }
  }, [allCards, allEdges, isVisible, setNodes, setEdges])

  // Capture user-dragged positions
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          userPositions.current.set(change.id, change.position)
        }
      }
    },
    [onNodesChange],
  )

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
            onNodesChange={handleNodesChange}
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
                Define Problem Vectors and add diagrams to the Whiteboard section.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
