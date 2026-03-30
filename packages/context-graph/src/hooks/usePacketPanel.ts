// ============================================================================
// usePacketPanel — Reads active packet from .context/ via fileService
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGraphStore } from '../state/store'
import { fileService } from '../compat/services'
import {
  parsePacketSections,
  parseProblemVectors,
  parseDeltaLog,
  type ProblemVectorEntry,
  type DeltaLogEntry,
} from '../components/packet/parsePacketContent'
import { parseNodes } from '../plugins/node/parser'
import type { NodeItem } from '../plugins/node/types'

export interface NodeSummary {
  nodeId: string
  state: string
  layer?: string
  subsystem?: string
  body: string
}

export interface WhiteboardSection {
  name: string
  mermaid: string
}

export interface UsePacketPanelResult {
  activePacketId: string | null
  packetName: string | null
  whiteboard: WhiteboardSection[]
  vectors: ProblemVectorEntry[]
  nodes: NodeSummary[]
  deltas: DeltaLogEntry[]
  rawContent: string | null
  isLoading: boolean
  refresh: () => void
}

export function usePacketPanel(): UsePacketPanelResult {
  const storePacketId = useGraphStore(s => s.activePacketId)
  const projectPath = useGraphStore(s => s.projectPath)
  const [activePacketId, setActivePacketId] = useState<string | null>(storePacketId)
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const refresh = useCallback(() => {
    setFetchKey(k => k + 1)
  }, [])

  // Sync from store or detect from .context/active marker
  useEffect(() => {
    setActivePacketId(storePacketId)
    if (storePacketId) return
    if (!projectPath) return

    // Try to read .context/active marker file
    let cancelled = false
    const markerPath = `${projectPath}/.context/active`
    fileService.read(markerPath).then(content => {
      if (cancelled) return
      const name = content.trim()
      if (name) {
        setActivePacketId(name)
        useGraphStore.getState().setActivePacketId(name)
      }
    }).catch(() => {
      // No active marker — that's fine
    })
    return () => { cancelled = true }
  }, [storePacketId, projectPath, fetchKey])

  // Read the actual packet markdown file
  useEffect(() => {
    if (!activePacketId || !projectPath) {
      setRawContent(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const packetPath = `${projectPath}/.context/packets/active/${activePacketId}.md`
    fileService.read(packetPath).then(content => {
      if (cancelled) return
      setRawContent(content || null)
      setIsLoading(false)
    }).catch(() => {
      if (cancelled) return
      setRawContent(null)
      setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [activePacketId, projectPath, fetchKey])

  // Parse content
  const sections = useMemo(
    () => rawContent ? parsePacketSections(rawContent) : [],
    [rawContent],
  )

  const whiteboard = useMemo<WhiteboardSection[]>(() => {
    const wb = sections.find(s => s.name === 'Whiteboard')
    if (!wb) return []
    const results: WhiteboardSection[] = []
    // Split by ### subsections, each containing a ```mermaid block
    const subsectionRe = /###\s+(.+)\n([\s\S]*?)(?=\n###\s|\n##\s|$)/g
    let m: RegExpExecArray | null
    while ((m = subsectionRe.exec(wb.content)) !== null) {
      const name = m[1].trim()
      const body = m[2]
      const mermaidMatch = body.match(/```mermaid\n([\s\S]*?)```/)
      if (mermaidMatch) {
        results.push({ name, mermaid: mermaidMatch[1].trim() })
      }
    }
    return results
  }, [sections])

  const vectors = useMemo(
    () => parseProblemVectors(sections),
    [sections],
  )

  const deltas = useMemo(
    () => parseDeltaLog(sections),
    [sections],
  )

  const nodes = useMemo<NodeSummary[]>(() => {
    const nodesSection = sections.find(s => s.name === 'Nodes' || s.name === 'AICCL')
    if (!nodesSection) return []
    const result = parseNodes(nodesSection.content, 'packet')
    return result.items.map((item: NodeItem) => ({
      nodeId: item.nodeId,
      state: item.state,
      layer: item.layer,
      subsystem: item.subsystem,
      body: item.body,
    }))
  }, [sections])

  // Derive packet name from the h1 or activePacketId
  const packetName = useMemo(() => {
    if (!rawContent) return activePacketId
    const h1Match = rawContent.match(/^# (.+)/m)
    return h1Match?.[1]?.trim() ?? activePacketId
  }, [rawContent, activePacketId])

  return {
    activePacketId,
    packetName,
    whiteboard,
    vectors,
    nodes,
    deltas,
    rawContent,
    isLoading,
    refresh,
  }
}
