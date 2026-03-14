// ============================================================================
// PacketEngine — Structured operations for the v2 packet system
// ============================================================================

import type { PacketDatabase } from './storage/PacketDatabase.js'
import type {
  FileService,
  PacketMeta,
  CreatePacketOptions,
  DeltaType,
  NodeState,
  ZoomLayer,
  DeltaEntry,
} from './types.js'
import {
  generatePacketMarkdown,
  type ProblemVectorState,
  type NodeContent,
} from './template.js'
import {
  formatInjectionContent,
  injectPacketIntoContent,
  removePacketSection,
} from './injection.js'
import { generateWorkflowSection } from './instructions.js'
import { materializeDocs } from './docs/materialize.js'
import { renderSubsystemDocs } from './docs/render.js'
import {
  needsKeyframe,
  DEFAULT_COMPRESSION_CONFIG,
  type VersionCompressionConfig,
} from './compression.js'

// ── Prefixes for special node types ────────────────────────────────────────

const VECTOR_PREFIX = 'vector:'
const WHITEBOARD_PREFIX = 'whiteboard:'

// ── PacketEngine ───────────────────────────────────────────────────────────

export class PacketEngine {
  private compressionConfig: VersionCompressionConfig

  constructor(
    private db: PacketDatabase,
    private contextDir: string,
    private fs: FileService,
    compressionConfig?: Partial<VersionCompressionConfig>,
  ) {
    this.compressionConfig = { ...DEFAULT_COMPRESSION_CONFIG, ...compressionConfig }
  }

  // ── Packet Lifecycle ──────────────────────────────────────────

  /**
   * Create a new packet, optionally seeding from a problem vector.
   * Writes initial metadata, version, and materializes to file.
   * Sets this packet as active and writes the filesystem marker.
   */
  async seed(name: string, options?: CreatePacketOptions): Promise<void> {
    const now = Date.now()
    await this.db.setPacketMeta(name, {
      name,
      createdAt: now,
      updatedAt: now,
      planFileRef: options?.planFileRef,
    })

    // If problem vector provided, seed it as a vector node
    if (options?.problemVector) {
      const vectorId = 'primary'
      await this.db.appendDelta(name, {
        nodeId: `${VECTOR_PREFIX}${vectorId}`,
        type: 'discovery',
        content: JSON.stringify({
          current: options.problemVector.current,
          target: options.problemVector.target,
          approach: options.problemVector.approach,
          state: 'active' as NodeState,
        }),
      })
    }

    // Pre-seed accumulated knowledge from existing patterns
    const allPatterns = await this.db.getAllPatterns()
    if (allPatterns.length > 0) {
      for (const pattern of allPatterns) {
        await this.db.appendDelta(name, {
          nodeId: `pattern:${pattern.subsystem}`,
          type: 'discovery',
          content: pattern.content,
        })
      }
    }

    // Set as active packet
    await this.db.setActivePacket(name)
    await this.syncActiveMarker(name)

    // Write initial version and materialize
    await this.writeVersionAndMaterialize(name, 'delta')
  }

  /**
   * Write current state to .context/packets/active/{name}.md
   */
  async materialize(name: string): Promise<string> {
    const content = await this.buildMarkdown(name)
    const filePath = this.getPacketPath(name)

    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    await this.fs.mkdir(dir)
    await this.fs.write(filePath, content)

    return filePath
  }

  /**
   * Rebuild markdown from latest DB version (if file corrupted).
   */
  async reconstruct(name: string): Promise<string> {
    const version = await this.db.getLatestVersion(name)
    if (!version) {
      throw new Error(`No versions found for packet: ${name}`)
    }

    const filePath = this.getPacketPath(name)
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    await this.fs.mkdir(dir)
    await this.fs.write(filePath, version.content)
    return filePath
  }

  /**
   * Archive packet: extract success patterns, write final keyframe, update meta.
   */
  async archive(name: string): Promise<void> {
    // Get all deltas to find success nodes
    const deltas = await this.db.getDeltas(name)
    const successNodeIds = new Set<string>()

    for (const d of deltas) {
      if (d.type === 'success' && d.nodeId && !d.nodeId.startsWith(VECTOR_PREFIX) && !d.nodeId.startsWith(WHITEBOARD_PREFIX)) {
        successNodeIds.add(d.nodeId)
      }
    }

    // Extract success nodes as patterns
    for (const nodeId of successNodeIds) {
      const nodeDeltas = await this.db.getDeltasForNode(name, nodeId)
      const collapsed = this.collapseDeltas(nodeDeltas)
      await this.db.writePattern({
        subsystem: nodeId,
        content: collapsed,
        sourcePacket: name,
      })
    }

    // Write final keyframe
    const content = await this.buildMarkdown(name)
    await this.db.writeKeyframe(name, 'archive', content)

    // Write final version
    await this.db.writeVersion(name, 'keyframe', content)

    // Aggressive prune: keep only the final keyframe version
    await this.db.pruneVersions(name, 1)

    // Update meta
    await this.db.setPacketMeta(name, { updatedAt: Date.now() })

    // Move file to archive directory
    const currentPath = this.getPacketPath(name)
    const archiveDir = `${this.contextDir}/packets/archive`
    const archivePath = `${archiveDir}/${name}.md`
    await this.fs.mkdir(archiveDir)
    await this.fs.write(archivePath, content)

    // Remove current file if it exists
    if (await this.fs.exists(currentPath)) {
      await this.fs.remove(currentPath)
    }

    // Clear active packet if this was it
    const active = await this.db.getActivePacket()
    if (active === name) {
      await this.db.setActivePacket(null)
      await this.syncActiveMarker(null)
    }
  }

  // ── Node Operations (AICCL) ───────────────────────────────────

  /**
   * Update or create a node. Appends a delta and materializes.
   */
  async nodeUpdate(
    packetName: string,
    nodeId: string,
    state: NodeState,
    content: string,
    layer?: ZoomLayer,
  ): Promise<void> {
    const deltaType: DeltaType = state === 'success' ? 'success' : 'discovery'
    const deltaContent = layer
      ? JSON.stringify({ content, layer })
      : content

    await this.db.appendDelta(packetName, {
      nodeId,
      type: deltaType,
      content: deltaContent,
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  /**
   * Promote a node to success: collapse delta chain, emit keyframe,
   * then prune the source deltas that were collapsed.
   */
  async nodePromote(packetName: string, nodeId: string): Promise<void> {
    const deltas = await this.db.getDeltasForNode(packetName, nodeId)
    if (deltas.length === 0) {
      throw new Error(`No deltas found for node "${nodeId}" in packet "${packetName}"`)
    }

    // Collapse all deltas into single content
    const collapsed = this.collapseDeltas(deltas)

    // Write keyframe
    await this.db.writeKeyframe(packetName, nodeId, collapsed)

    // Record the cutoff before appending the promotion delta
    const cutoff = Date.now()

    // Append promotion delta
    await this.db.appendDelta(packetName, {
      nodeId,
      type: 'promotion',
      content: collapsed,
    })

    // Prune the pre-promotion deltas for this node (keep only the promotion delta)
    await this.db.deleteDeltasBeforeForNode(packetName, nodeId, cutoff)

    await this.writeVersionAndMaterialize(packetName, 'keyframe')
  }

  /**
   * Mark node as failed with what was tried and why.
   */
  async nodeFail(
    packetName: string,
    nodeId: string,
    tried: string,
    reason: string,
  ): Promise<void> {
    await this.db.appendDelta(packetName, {
      nodeId,
      type: 'failure',
      content: `Tried: ${tried}\nReason: ${reason}`,
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  // ── Whiteboard Operations ─────────────────────────────────────

  /**
   * Update a whiteboard section with mermaid content.
   */
  async whiteboardUpdate(
    packetName: string,
    section: string,
    mermaid: string,
  ): Promise<void> {
    await this.db.appendDelta(packetName, {
      nodeId: `${WHITEBOARD_PREFIX}${section}`,
      type: 'discovery',
      content: mermaid,
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  // ── Delta Operations ──────────────────────────────────────────

  /**
   * Log a mutation to the delta log.
   */
  async deltaAppend(
    packetName: string,
    nodeId: string | undefined,
    type: DeltaType,
    content: string,
  ): Promise<void> {
    await this.db.appendDelta(packetName, { nodeId, type, content })
    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  /**
   * Collapse resolved delta chain for a node.
   * Writes a keyframe, appends a single collapse delta, and prunes the
   * source deltas that were folded into the keyframe.
   */
  async collapse(packetName: string, nodeId: string): Promise<void> {
    const deltas = await this.db.getDeltasForNode(packetName, nodeId)
    if (deltas.length === 0) {
      throw new Error(`No deltas found for node "${nodeId}" in packet "${packetName}"`)
    }

    const collapsed = this.collapseDeltas(deltas)

    // Write keyframe
    await this.db.writeKeyframe(packetName, nodeId, collapsed)

    // Record the cutoff before appending the collapse delta
    const cutoff = Date.now()

    // Append collapse delta
    await this.db.appendDelta(packetName, {
      nodeId,
      type: 'collapse',
      content: collapsed,
    })

    // Prune the pre-collapse deltas for this node (keep only the collapse delta)
    await this.db.deleteDeltasBeforeForNode(packetName, nodeId, cutoff)

    await this.writeVersionAndMaterialize(packetName, 'collapse')
  }

  // ── Problem Vectors ───────────────────────────────────────────

  /**
   * Update a problem vector.
   */
  async vectorUpdate(
    packetName: string,
    vectorId: string,
    current: string,
    target: string,
    approach: string,
    state: NodeState = 'active',
  ): Promise<void> {
    await this.db.appendDelta(packetName, {
      nodeId: `${VECTOR_PREFIX}${vectorId}`,
      type: state === 'success' ? 'success' : 'discovery',
      content: JSON.stringify({ current, target, approach, state }),
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  /**
   * Resolve a vector (mark success, trigger promotion).
   */
  async vectorResolve(packetName: string, vectorId: string): Promise<void> {
    const fullId = `${VECTOR_PREFIX}${vectorId}`
    const deltas = await this.db.getDeltasForNode(packetName, fullId)
    if (deltas.length === 0) {
      throw new Error(`No deltas found for vector "${vectorId}" in packet "${packetName}"`)
    }

    // Get current vector state from latest delta
    const latest = deltas[deltas.length - 1]
    let vectorData: { current: string; target: string; approach: string }
    try {
      vectorData = JSON.parse(latest.content)
    } catch {
      throw new Error(`Invalid vector data for "${vectorId}" in packet "${packetName}"`)
    }

    // Update with success state
    await this.db.appendDelta(packetName, {
      nodeId: fullId,
      type: 'success',
      content: JSON.stringify({
        ...vectorData,
        state: 'success',
      }),
    })

    // Write keyframe for the vector
    const collapsed = this.collapseDeltas([...deltas, {
      id: '',
      packetName,
      timestamp: Date.now(),
      nodeId: fullId,
      type: 'success',
      content: JSON.stringify({ ...vectorData, state: 'success' }),
    }])
    await this.db.writeKeyframe(packetName, fullId, collapsed)

    await this.writeVersionAndMaterialize(packetName, 'keyframe')
  }

  // ── CLAUDE.md Injection ───────────────────────────────────────

  /**
   * Get content suitable for CLAUDE.md injection.
   * Returns null if no active packet or no vectors.
   */
  async getInjectionContent(packetName?: string): Promise<string | null> {
    const name = packetName ?? await this.db.getActivePacket()
    if (!name) return null

    const meta = await this.db.getPacketMeta(name)
    if (!meta) return null

    // Build vectors from DB state
    const vectors = await this.getVectorStates(name)
    const packetPath = this.getPacketPath(name)

    const summary = formatInjectionContent(name, vectors, packetPath)
    const workflow = generateWorkflowSection()

    return summary + '\n\n' + workflow
  }

  /**
   * Insert/replace managed section in file content.
   */
  injectIntoContent(fileContent: string, packetSection: string): string {
    return injectPacketIntoContent(fileContent, packetSection)
  }

  /**
   * Remove managed section from file content.
   */
  removeFromContent(fileContent: string): string {
    return removePacketSection(fileContent)
  }

  // ── Documentation ───────────────────────────────────────────

  /**
   * Materialize all patterns to .context/docs/ as AICCL documentation.
   */
  async materializeDocs(): Promise<void> {
    await materializeDocs(this.db, this.contextDir, this.fs)
  }

  /**
   * Render docs for a subsystem in AICCL or human-readable format.
   */
  async renderDocs(
    subsystem: string,
    format: 'aiccl' | 'human' = 'aiccl',
  ): Promise<string> {
    const patterns = await this.db.findPatterns(subsystem)
    return renderSubsystemDocs(subsystem, patterns, format)
  }

  // ── Internal Helpers ──────────────────────────────────────────

  getPacketPath(name: string): string {
    return `${this.contextDir}/packets/active/${name}.md`
  }

  getContextDir(): string {
    return this.contextDir
  }

  /**
   * Write or remove the .context/active marker file.
   * This file is read by the fast-path `packet context` command
   * so it can avoid loading the DB on every prompt.
   */
  async syncActiveMarker(name: string | null): Promise<void> {
    const markerPath = `${this.contextDir}/active`
    if (name) {
      await this.fs.mkdir(this.contextDir)
      await this.fs.write(markerPath, name)
    } else {
      if (await this.fs.exists(markerPath)) {
        await this.fs.remove(markerPath)
      }
    }
  }

  /**
   * Build full markdown from DB state.
   */
  private async buildMarkdown(name: string): Promise<string> {
    const meta = await this.db.getPacketMeta(name)

    // Gather whiteboard sections
    const whiteboard = await this.getWhiteboardSections(name)

    // Gather problem vectors
    const problemVectors = await this.getVectorStates(name)

    // Gather AICCL nodes (non-vector, non-whiteboard)
    const nodes = await this.getNodeContents(name)

    // Gather deltas (most recent)
    const deltas = await this.db.getDeltas(name)

    return generatePacketMarkdown(name, {
      whiteboard,
      problemVectors,
      nodes,
      deltas,
      linked: { planFileRef: meta?.planFileRef },
    })
  }

  /**
   * Extract whiteboard sections from delta chain.
   * Each whiteboard section is keyed by its section name.
   * Uses the latest delta content for each section.
   */
  private async getWhiteboardSections(packetName: string): Promise<Map<string, string>> {
    const deltas = await this.db.getDeltas(packetName)
    const sections = new Map<string, string>()

    for (const d of deltas) {
      if (d.nodeId && d.nodeId.startsWith(WHITEBOARD_PREFIX)) {
        const section = d.nodeId.slice(WHITEBOARD_PREFIX.length)
        sections.set(section, d.content)
      }
    }

    return sections
  }

  /**
   * Extract vector states from delta chain.
   */
  private async getVectorStates(packetName: string): Promise<ProblemVectorState[]> {
    const deltas = await this.db.getDeltas(packetName)
    const vectorMap = new Map<string, ProblemVectorState>()

    for (const d of deltas) {
      if (d.nodeId && d.nodeId.startsWith(VECTOR_PREFIX)) {
        const vectorId = d.nodeId.slice(VECTOR_PREFIX.length)
        try {
          const data = JSON.parse(d.content)
          vectorMap.set(vectorId, {
            id: vectorId,
            current: data.current ?? '',
            target: data.target ?? '',
            approach: data.approach ?? '',
            state: data.state ?? 'active',
          })
        } catch {
          // Non-JSON vector content, skip
        }
      }
    }

    return Array.from(vectorMap.values())
  }

  /**
   * Extract regular AICCL node contents from delta chain.
   * Composes latest state from deltas for each nodeId.
   */
  private async getNodeContents(packetName: string): Promise<NodeContent[]> {
    const deltas = await this.db.getDeltas(packetName)

    // Group deltas by nodeId, excluding vector and whiteboard nodes
    const nodeMap = new Map<string, { state: NodeState; layer?: ZoomLayer; body: string }>()

    for (const d of deltas) {
      if (!d.nodeId) continue
      if (d.nodeId.startsWith(VECTOR_PREFIX)) continue
      if (d.nodeId.startsWith(WHITEBOARD_PREFIX)) continue

      // Determine state from delta type
      let state: NodeState = 'active'
      if (d.type === 'success' || d.type === 'promotion') state = 'success'
      else if (d.type === 'failure') state = 'failed'

      // Try to parse layer from JSON content
      let body = d.content
      let layer: ZoomLayer | undefined
      try {
        const parsed = JSON.parse(d.content)
        if (parsed.content && parsed.layer) {
          body = parsed.content
          layer = parsed.layer
        }
      } catch {
        // Not JSON, use raw content
      }

      nodeMap.set(d.nodeId, { state, layer, body })
    }

    const nodes: NodeContent[] = []
    for (const [id, data] of nodeMap) {
      nodes.push({
        id,
        state: data.state,
        layer: data.layer,
        body: data.body,
      })
    }

    return nodes
  }

  /**
   * Collapse delta entries into a single content string.
   */
  private collapseDeltas(deltas: DeltaEntry[]): string {
    if (deltas.length === 0) return ''
    // Use the last delta's content as the collapsed result
    return deltas[deltas.length - 1].content
  }

  /**
   * Write a version snapshot with keyframe/delta compression, then
   * prune old versions and materialize to file.
   *
   * The latest version ALWAYS stores full content so that
   * `getLatestVersion()` returns immediately usable markdown.
   *
   * Keyframe versions (trigger = 'keyframe' | 'collapse', or periodic
   * interval) are never pruned — they anchor history reconstruction.
   */
  private async writeVersionAndMaterialize(
    packetName: string,
    trigger: 'delta' | 'keyframe' | 'collapse',
  ): Promise<void> {
    const content = await this.buildMarkdown(packetName)

    if (trigger === 'keyframe' || trigger === 'collapse') {
      // Explicit keyframe/collapse — always store full content as keyframe
      await this.db.writeVersion(packetName, trigger, content)
    } else {
      // Delta trigger — check if we should auto-promote to keyframe
      const recent = await this.db.getVersions(
        packetName,
        this.compressionConfig.keyframeInterval + 1,
      )
      const lastKeyframeIdx = recent.findIndex(
        v => v.trigger === 'keyframe' || v.trigger === 'collapse',
      )
      const deltasSinceKeyframe =
        lastKeyframeIdx === -1 ? recent.length : lastKeyframeIdx

      if (needsKeyframe(deltasSinceKeyframe, this.compressionConfig)) {
        // Auto-promote to keyframe
        await this.db.writeVersion(packetName, 'keyframe', content)
      } else {
        await this.db.writeVersion(packetName, trigger, content)
      }
    }

    // Prune old versions beyond the configured max
    await this.db.pruneVersions(packetName, this.compressionConfig.maxVersionsPerPacket)

    await this.materialize(packetName)
  }
}
