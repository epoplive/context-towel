/**
 * Session Tree -- Append-only tree structure for conversations
 *
 * Maps to WorkflowExecution. Branching = exploring different directions.
 * Each branch has its delta trajectory.
 *
 * Key concepts:
 *   - SessionEntry: node in tree with id + parentId
 *   - SessionTree: append-only tree with leaf pointer
 *   - Context = path from root to leaf (only current branch visible to LLM)
 *   - Branching: move leaf, old branch stays (like git)
 *   - Compaction: summarize trajectory + compress to keyframe
 *   - Branch summaries: inject summary of abandoned path
 */

import {
  type EmbeddingVector,
  type ProblemStateVector,
  embedText,
} from './vector-state'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionEntryType =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'compaction'
  | 'branch_summary'
  | 'keyframe'
  | 'metadata'

export interface SessionEntry {
  id: string
  parentId: string | null
  type: SessionEntryType
  timestamp: number
  content: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  embedding?: EmbeddingVector
  tokenEstimate: number
}

export interface MessageEntry extends SessionEntry {
  type: 'message'
}

export interface ToolCallEntry extends SessionEntry {
  type: 'tool_call'
  role: 'assistant'
  toolName: string
  toolArgs: Record<string, unknown>
}

export interface ToolResultEntry extends SessionEntry {
  type: 'tool_result'
  role: 'tool'
  success: boolean
  durationMs: number
}

export interface CompactionEntry extends SessionEntry {
  type: 'compaction'
  role: 'system'
  summary: string
  firstKeptEntryId: string
  tokensBefore: number
  tokensAfter: number
}

export interface BranchSummaryEntry extends SessionEntry {
  type: 'branch_summary'
  role: 'system'
  fromBranchLeafId: string
  summary: string
}

export interface KeyframeEntry extends SessionEntry {
  type: 'keyframe'
  role: 'system'
  state: ProblemStateVector
}

export interface SessionTreeNode {
  entry: SessionEntry
  children: SessionTreeNode[]
}

// ─── Session Tree ────────────────────────────────────────────────────────────

export interface SessionTreeConfig {
  maxTokens: number
  targetTokensAfterCompaction: number
  autoEmbed: boolean
}

const DEFAULT_CONFIG: SessionTreeConfig = {
  maxTokens: 100000,
  targetTokensAfterCompaction: 50000,
  autoEmbed: false,
}

export class SessionTree {
  private readonly byId: Map<string, SessionEntry> = new Map()
  private readonly childrenOf: Map<string | null, string[]> = new Map()
  private leafId: string | null = null
  readonly sessionId: string
  readonly config: SessionTreeConfig
  private idCounter: number = 0

  constructor(sessionId: string, config?: Partial<SessionTreeConfig>) {
    this.sessionId = sessionId
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private generateId(): string {
    return `${this.sessionId}-${++this.idCounter}`
  }

  // ─── Append ────────────────────────────────────────────────────────

  append(entry: Omit<SessionEntry, 'id' | 'parentId' | 'timestamp'>): SessionEntry {
    const id = this.generateId()
    const fullEntry: SessionEntry = {
      ...entry,
      id,
      parentId: this.leafId,
      timestamp: Date.now(),
    }

    if (this.config.autoEmbed && !fullEntry.embedding) {
      fullEntry.embedding = embedText(fullEntry.content)
    }

    this.byId.set(id, fullEntry)
    const siblings = this.childrenOf.get(this.leafId) ?? []
    siblings.push(id)
    this.childrenOf.set(this.leafId, siblings)

    this.leafId = id
    return fullEntry
  }

  appendMessage(content: string, role: 'user' | 'assistant' | 'system' = 'user'): SessionEntry {
    return this.append({
      type: 'message',
      content,
      role,
      tokenEstimate: estimateTokens(content),
    })
  }

  appendToolCall(toolName: string, toolArgs: Record<string, unknown>): SessionEntry {
    const content = `${toolName}(${JSON.stringify(toolArgs)})`
    const entry = this.append({
      type: 'tool_call',
      content,
      role: 'assistant',
      tokenEstimate: estimateTokens(content),
    })
    ;(entry as ToolCallEntry).toolName = toolName
    ;(entry as ToolCallEntry).toolArgs = toolArgs
    return entry
  }

  appendToolResult(content: string, success: boolean, durationMs: number): SessionEntry {
    const entry = this.append({
      type: 'tool_result',
      content,
      role: 'tool',
      tokenEstimate: estimateTokens(content),
    })
    ;(entry as ToolResultEntry).success = success
    ;(entry as ToolResultEntry).durationMs = durationMs
    return entry
  }

  // ─── Branch ────────────────────────────────────────────────────────

  branch(fromId: string, summary?: string): string {
    const entry = this.byId.get(fromId)
    if (!entry) {
      throw new Error(`Entry ${fromId} not found`)
    }

    const oldLeafId = this.leafId
    this.leafId = fromId

    if (summary && oldLeafId) {
      this.append({
        type: 'branch_summary',
        content: summary,
        role: 'system',
        tokenEstimate: estimateTokens(summary),
      })
      const branchEntry = this.byId.get(this.leafId) as BranchSummaryEntry
      if (branchEntry.type === 'branch_summary') {
        branchEntry.fromBranchLeafId = oldLeafId
        branchEntry.summary = summary
      }
    }

    return this.leafId
  }

  branchFromParent(summary?: string): string {
    const leaf = this.getLeaf()
    if (!leaf || !leaf.parentId) {
      throw new Error('Cannot branch from root')
    }
    return this.branch(leaf.parentId, summary)
  }

  // ─── Navigation ────────────────────────────────────────────────────

  getEntry(id: string): SessionEntry | undefined {
    return this.byId.get(id)
  }

  getLeaf(): SessionEntry | null {
    if (!this.leafId) return null
    return this.byId.get(this.leafId) ?? null
  }

  getLeafId(): string | null {
    return this.leafId
  }

  getChildren(id: string | null): SessionEntry[] {
    const childIds = this.childrenOf.get(id) ?? []
    return childIds.map(cid => this.byId.get(cid)!).filter(Boolean)
  }

  getPathTo(id: string): SessionEntry[] {
    const path: SessionEntry[] = []
    let current: string | null = id

    while (current !== null) {
      const entry = this.byId.get(current)
      if (!entry) break
      path.unshift(entry)
      current = entry.parentId
    }

    return path
  }

  getContext(): SessionEntry[] {
    if (!this.leafId) return []
    return this.getPathTo(this.leafId)
  }

  getAllEntries(): SessionEntry[] {
    return Array.from(this.byId.values())
  }

  get size(): number {
    return this.byId.size
  }

  // ─── Tree Structure ────────────────────────────────────────────────

  getTree(): SessionTreeNode[] {
    const rootChildren = this.childrenOf.get(null) ?? []
    return rootChildren.map(id => this.buildTreeNode(id))
  }

  private buildTreeNode(id: string): SessionTreeNode {
    const entry = this.byId.get(id)!
    const childIds = this.childrenOf.get(id) ?? []
    return {
      entry,
      children: childIds.map(cid => this.buildTreeNode(cid)),
    }
  }

  getLeaves(): SessionEntry[] {
    const leaves: SessionEntry[] = []
    for (const [id, entry] of this.byId) {
      const children = this.childrenOf.get(id) ?? []
      if (children.length === 0) {
        leaves.push(entry)
      }
    }
    return leaves
  }

  getBranchPoints(): SessionEntry[] {
    const points: SessionEntry[] = []
    for (const [id, children] of this.childrenOf) {
      if (id !== null && children.length > 1) {
        points.push(this.byId.get(id)!)
      }
    }
    return points
  }

  // ─── Compaction ────────────────────────────────────────────────────

  getContextTokens(): number {
    const context = this.getContext()
    return context.reduce((sum, e) => sum + e.tokenEstimate, 0)
  }

  needsCompaction(): boolean {
    return this.getContextTokens() > this.config.maxTokens
  }

  compact(summary: string): CompactionEntry {
    const context = this.getContext()
    if (context.length < 3) {
      throw new Error('Not enough entries to compact')
    }

    const totalTokens = context.reduce((sum, e) => sum + e.tokenEstimate, 0)

    let keptTokens = 0
    let keepFromIndex = context.length - 1
    for (let i = context.length - 1; i >= 0; i--) {
      keptTokens += context[i]!.tokenEstimate
      if (keptTokens > this.config.targetTokensAfterCompaction) {
        keepFromIndex = i + 1
        break
      }
    }
    keepFromIndex = Math.max(1, keepFromIndex)

    const firstKeptEntry = context[keepFromIndex]!

    const compactionEntry = this.append({
      type: 'compaction',
      content: summary,
      role: 'system',
      tokenEstimate: estimateTokens(summary),
    }) as CompactionEntry

    compactionEntry.summary = summary
    compactionEntry.firstKeptEntryId = firstKeptEntry.id
    compactionEntry.tokensBefore = totalTokens
    compactionEntry.tokensAfter = keptTokens + compactionEntry.tokenEstimate

    return compactionEntry
  }

  // ─── Serialization ─────────────────────────────────────────────────

  toJsonLines(): string {
    const lines: string[] = []
    lines.push(JSON.stringify({
      type: 'session',
      id: this.sessionId,
      timestamp: new Date().toISOString(),
      leafId: this.leafId,
    }))
    for (const entry of this.byId.values()) {
      lines.push(JSON.stringify(entry))
    }
    return lines.join('\n')
  }

  static fromJsonLines(data: string): SessionTree {
    const lines = data.split('\n').filter(l => l.trim())
    if (lines.length === 0) throw new Error('Empty session data')

    const header = JSON.parse(lines[0]!)
    const tree = new SessionTree(header.id)

    for (let i = 1; i < lines.length; i++) {
      const entry = JSON.parse(lines[i]!) as SessionEntry
      tree.byId.set(entry.id, entry)
      const siblings = tree.childrenOf.get(entry.parentId) ?? []
      siblings.push(entry.id)
      tree.childrenOf.set(entry.parentId, siblings)

      const match = entry.id.match(/-(\d+)$/)
      if (match) {
        tree.idCounter = Math.max(tree.idCounter, parseInt(match[1]!, 10))
      }
    }

    tree.leafId = header.leafId ?? null
    return tree
  }

  static create(sessionId?: string, config?: Partial<SessionTreeConfig>): SessionTree {
    return new SessionTree(
      sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      config,
    )
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Summarize a branch for branch summary injection */
export function summarizeBranch(entries: SessionEntry[]): string {
  const messages = entries.filter(e => e.type === 'message')
  const toolCalls = entries.filter(e => e.type === 'tool_call')
  const toolResults = entries.filter(e => e.type === 'tool_result')

  const parts: string[] = []
  parts.push(`Branch with ${messages.length} messages, ${toolCalls.length} tool calls.`)

  if (toolResults.length > 0) {
    const successCount = (toolResults as ToolResultEntry[]).filter(r => r.success).length
    parts.push(`${successCount}/${toolResults.length} tool calls succeeded.`)
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage) {
    const preview = lastMessage.content.slice(0, 200)
    parts.push(`Last message: "${preview}${lastMessage.content.length > 200 ? '...' : ''}"`)
  }

  return parts.join(' ')
}
