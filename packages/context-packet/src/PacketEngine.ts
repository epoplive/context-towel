// ============================================================================
// PacketEngine — Structured operations for the v2 packet system
// ============================================================================

import type { PacketDatabase } from './storage/PacketDatabase.js'
import type {
  FileService,
  PacketMeta,
  PacketEdge,
  CreatePacketOptions,
  DeltaType,
  NodeState,
  NodeType,
  ZoomLayer,
  DeltaEntry,
} from './types.js'
import {
  generatePacketMarkdown,
  type ProblemVectorState,
  type NodeContent,
  type CriterionMark,
  type FactMark,
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
   * When type/path are provided, they are stored in the delta content JSON.
   */
  async nodeUpdate(
    packetName: string,
    nodeId: string,
    state: NodeState,
    content: string,
    layer?: ZoomLayer,
    nodeType?: NodeType,
    path?: string,
  ): Promise<void> {
    const deltaType: DeltaType = state === 'success' ? 'success' : 'discovery'

    // Build structured content when metadata is present
    const hasMetadata = layer || (nodeType && nodeType !== 'work') || path
    const deltaContent = hasMetadata
      ? JSON.stringify({
        content,
        ...(layer && { layer }),
        ...(nodeType && nodeType !== 'work' && { type: nodeType }),
        ...(path && { path }),
      })
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

  // ── Automatic Metadata Capture ───────────────────────────────

  /**
   * Route file changes to work nodes via reference edges.
   *
   * For each changed file path:
   * 1. Find reference nodes whose path matches (exact or suffix match)
   * 2. Follow edges from those reference nodes to work nodes
   * 3. Record a mutation delta on each connected work node
   *
   * Returns the number of deltas recorded.
   */
  async routeFileChanges(
    packetName: string,
    changedFiles: string[],
    commitInfo?: { hash: string; message: string },
  ): Promise<number> {
    if (changedFiles.length === 0) return 0

    const nodes = await this.getNodeContents(packetName)
    const edges = await this.db.getAllEdges(packetName)

    // Build reference node path → node ID index
    const refPathMap = new Map<string, string>()
    for (const node of nodes) {
      if (node.type === 'reference' && node.path) {
        refPathMap.set(node.path, node.id)
      }
    }

    // Build edge adjacency: refNodeId → Set<workNodeId>
    const refToWork = new Map<string, Set<string>>()
    for (const edge of edges) {
      // Reference nodes connect to work nodes
      if (refPathMap.has(edge.sourceNode) || [...refPathMap.values()].includes(edge.sourceNode)) {
        const refId = edge.sourceNode
        if (!refToWork.has(refId)) refToWork.set(refId, new Set())
        refToWork.get(refId)!.add(edge.targetNode)
      }
      if (refPathMap.has(edge.targetNode) || [...refPathMap.values()].includes(edge.targetNode)) {
        const refId = edge.targetNode
        if (!refToWork.has(refId)) refToWork.set(refId, new Set())
        refToWork.get(refId)!.add(edge.sourceNode)
      }
    }

    // Match changed files to reference nodes (suffix match)
    const workNodeChanges = new Map<string, string[]>()
    for (const file of changedFiles) {
      for (const [refPath, refId] of refPathMap) {
        if (file === refPath || file.endsWith(refPath) || refPath.endsWith(file)) {
          const connectedWork = refToWork.get(refId)
          if (connectedWork) {
            for (const workId of connectedWork) {
              if (!workNodeChanges.has(workId)) workNodeChanges.set(workId, [])
              workNodeChanges.get(workId)!.push(file)
            }
          }
        }
      }
    }

    // Record mutation deltas
    let deltaCount = 0
    for (const [workId, files] of workNodeChanges) {
      const content = commitInfo
        ? `Files changed (${commitInfo.hash}): ${files.join(', ')} — ${commitInfo.message}`
        : `Files changed: ${files.join(', ')}`

      await this.db.appendDelta(packetName, {
        nodeId: workId,
        type: 'mutation',
        content,
      })
      deltaCount++
    }

    if (deltaCount > 0) {
      await this.writeVersionAndMaterialize(packetName, 'delta')
    }

    return deltaCount
  }

  /**
   * Capture git commits as evidence deltas.
   * Each new commit becomes a discovery delta on work nodes
   * that have reference edges matching changed files.
   */
  async captureCommits(
    packetName: string,
    commits: Array<{ hash: string; message: string; files: string[] }>,
  ): Promise<number> {
    let deltaCount = 0
    for (const commit of commits) {
      deltaCount += await this.routeFileChanges(packetName, commit.files, {
        hash: commit.hash,
        message: commit.message,
      })
    }
    return deltaCount
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

  // ── Vector Criteria Operations ───────────────────────────────

  /**
   * Add a criterion to a vector's solved criteria or problem facts.
   */
  async vectorCriterionAdd(
    packetName: string,
    vectorId: string,
    text: string,
    type: 'solved' | 'fact' = 'solved',
    mark?: string,
  ): Promise<void> {
    const vectors = await this.getVectorStates(packetName)
    const vector = vectors.find(v => v.id === vectorId)
    if (!vector) {
      throw new Error(`Vector "${vectorId}" not found in packet "${packetName}"`)
    }

    // Mutate the vector state (push new criterion into existing array)
    const resolvedMark = mark ?? (type === 'solved' ? 'pending' : 'established')
    if (type === 'solved') {
      const criteria = vector.solvedCriteria ?? []
      criteria.push({ text, mark: resolvedMark as CriterionMark })
      vector.solvedCriteria = criteria
    } else {
      const facts = vector.problemFacts ?? []
      facts.push({ text, mark: resolvedMark as FactMark })
      vector.problemFacts = facts
    }

    // Write full vector snapshot so getVectorStates can reconstruct criteria
    await this.db.appendDelta(packetName, {
      nodeId: `${VECTOR_PREFIX}${vectorId}`,
      type: 'mutation',
      content: JSON.stringify({
        current: vector.current,
        target: vector.target,
        approach: vector.approach,
        state: vector.state,
        solvedCriteria: vector.solvedCriteria,
        problemFacts: vector.problemFacts,
      }),
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  /**
   * Update the mark of a specific criterion by index.
   */
  async vectorCriterionUpdate(
    packetName: string,
    vectorId: string,
    index: number,
    mark: string,
    type: 'solved' | 'fact' = 'solved',
  ): Promise<void> {
    const vectors = await this.getVectorStates(packetName)
    const vector = vectors.find(v => v.id === vectorId)
    if (!vector) {
      throw new Error(`Vector "${vectorId}" not found in packet "${packetName}"`)
    }

    // Mutate the criterion in place
    if (type === 'solved') {
      const criteria = vector.solvedCriteria ?? []
      if (index < 0 || index >= criteria.length) {
        throw new Error(`Criterion index ${index} out of range (0-${criteria.length - 1})`)
      }
      criteria[index].mark = mark as CriterionMark
    } else {
      const facts = vector.problemFacts ?? []
      if (index < 0 || index >= facts.length) {
        throw new Error(`Fact index ${index} out of range (0-${facts.length - 1})`)
      }
      facts[index].mark = mark as FactMark
    }

    // Write full vector snapshot so getVectorStates can reconstruct criteria
    await this.db.appendDelta(packetName, {
      nodeId: `${VECTOR_PREFIX}${vectorId}`,
      type: 'mutation',
      content: JSON.stringify({
        current: vector.current,
        target: vector.target,
        approach: vector.approach,
        state: vector.state,
        solvedCriteria: vector.solvedCriteria,
        problemFacts: vector.problemFacts,
      }),
    })

    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  // ── Edge Operations ──────────────────────────────────────────

  /**
   * Add an edge between two nodes. Materializes after change.
   */
  async edgeAdd(packetName: string, sourceNode: string, targetNode: string): Promise<string> {
    const id = await this.db.addEdge(packetName, sourceNode, targetNode)
    await this.writeVersionAndMaterialize(packetName, 'delta')
    return id
  }

  /**
   * Remove an edge between two nodes. Materializes after change.
   */
  async edgeRemove(packetName: string, sourceNode: string, targetNode: string): Promise<void> {
    await this.db.removeEdge(packetName, sourceNode, targetNode)
    await this.writeVersionAndMaterialize(packetName, 'delta')
  }

  /**
   * List edges, optionally filtered to a specific node.
   */
  async edgeList(packetName: string, nodeId?: string): Promise<PacketEdge[]> {
    if (nodeId) {
      return this.db.getEdgesForNode(packetName, nodeId)
    }
    return this.db.getAllEdges(packetName)
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

  // ── Packet Slicing ──────────────────────────────────────────

  /**
   * Produce a minimal self-contained packet for specific nodes.
   * Contains: relevant comp maps, nodes with bodies, transitive derives-from chain,
   * relevant solved criteria, and relevant delta log entries.
   * Output: valid packet markdown a subagent can load independently.
   */
  async sliceForNode(packetName: string, nodeIds: string[]): Promise<string> {
    const content = await this.buildMarkdown(packetName)

    // Find all ~~~node blocks
    const nodePattern = /~~~node\s*\n([\s\S]*?)~~~/g
    const allNodes = new Map<string, { header: string; body: string; full: string }>()
    let nm: RegExpExecArray | null
    while ((nm = nodePattern.exec(content)) !== null) {
      const block = nm[1]
      const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim()
      if (!id) continue
      const sepIdx = block.indexOf('\n---')
      const header = sepIdx !== -1 ? block.slice(0, sepIdx) : block
      const body = sepIdx !== -1 ? block.slice(sepIdx + 4).trim() : ''
      allNodes.set(id, { header, body, full: nm[0] })
    }

    // Walk transitive closure using DB edges
    const allEdges = await this.db.getAllEdges(packetName)
    const resolvedIds = new Set<string>()
    const queue = [...nodeIds]
    while (queue.length > 0) {
      const id = queue.pop()!
      if (resolvedIds.has(id)) continue
      resolvedIds.add(id)

      // Find all nodes connected via edges (both directions)
      for (const edge of allEdges) {
        if (edge.sourceNode === id && !resolvedIds.has(edge.targetNode)) {
          queue.push(edge.targetNode)
        }
        if (edge.targetNode === id && !resolvedIds.has(edge.sourceNode)) {
          queue.push(edge.sourceNode)
        }
      }
    }

    // Collect all referenced node blocks
    const slicedNodes: string[] = []
    for (const id of resolvedIds) {
      const node = allNodes.get(id)
      if (node) slicedNodes.push(node.full)
    }

    // Find comp maps referenced by the sliced nodes
    const compMapPattern = /<comp:map:(\w[\w-]*)(?:\s+uses="(\w[\w-]*)")?\s*>([\s\S]*?)<\/comp:map:\1>/g
    const allMaps = new Map<string, string>()
    let cm: RegExpExecArray | null
    while ((cm = compMapPattern.exec(content)) !== null) {
      allMaps.set(cm[1], cm[0])
    }

    // Find maps referenced by the sliced nodes (via `maps:` header field)
    const referencedMaps = new Set<string>()
    for (const id of resolvedIds) {
      const node = allNodes.get(id)
      if (!node) continue
      const mapsMatch = node.header.match(/^maps:\s*(.+)/m)
      if (mapsMatch) {
        for (const mapRef of mapsMatch[1].split(',').map(s => s.trim()).filter(Boolean)) {
          referencedMaps.add(mapRef)
          // Walk parent chain
          const mapBlock = allMaps.get(mapRef)
          if (mapBlock) {
            const parentMatch = mapBlock.match(/uses="(\w[\w-]*)"/)
            if (parentMatch) referencedMaps.add(parentMatch[1])
          }
        }
      }
    }

    // If no specific maps referenced, include all maps (they're small)
    const mapsToInclude = referencedMaps.size > 0
      ? [...referencedMaps].filter(id => allMaps.has(id)).map(id => allMaps.get(id)!)
      : [...allMaps.values()]

    // Collect relevant criteria from vectors
    const vectorSection = content.match(/## Problem Vectors\s*\n([\s\S]*?)(?=\n## |\n# |$)/)
    const criteriaLines: string[] = []
    if (vectorSection) {
      // Find criteria that reference any of our nodes
      const criteriaRe = /- \[[^\]]*\] .+?\(proven by ([^)]+)\)/g
      let crm: RegExpExecArray | null
      while ((crm = criteriaRe.exec(vectorSection[1])) !== null) {
        if (resolvedIds.has(crm[1].trim())) {
          criteriaLines.push(crm[0])
        }
      }
    }

    // Collect relevant deltas
    const deltaSection = content.match(/## Delta Log\s*\n([\s\S]*?)(?=\n## |\n# |$)/)
    const deltaLines: string[] = []
    if (deltaSection) {
      const deltaRe = /^- .+$/gm
      let dm: RegExpExecArray | null
      while ((dm = deltaRe.exec(deltaSection[1])) !== null) {
        // Include if delta mentions any of our node IDs
        if ([...resolvedIds].some(id => dm![0].includes(`[${id}]`))) {
          deltaLines.push(dm[0])
        }
      }
    }

    // Build the slice markdown
    const lines: string[] = []
    lines.push(`# Packet Slice: ${packetName}`)
    lines.push(`<!-- Slice for nodes: ${nodeIds.join(', ')} -->`)
    lines.push('')

    if (mapsToInclude.length > 0) {
      lines.push('## Compression Maps')
      lines.push('')
      for (const map of mapsToInclude) {
        lines.push(map)
        lines.push('')
      }
    }

    if (criteriaLines.length > 0) {
      lines.push('## Relevant Criteria')
      lines.push('')
      for (const c of criteriaLines) {
        lines.push(c)
      }
      lines.push('')
    }

    lines.push('## AICCL')
    lines.push('')
    for (const node of slicedNodes) {
      lines.push(node)
      lines.push('')
    }

    if (deltaLines.length > 0) {
      lines.push('## Delta Log')
      lines.push('')
      for (const d of deltaLines) {
        lines.push(d)
      }
      lines.push('')
    }

    return lines.join('\n')
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

    // Gather edges
    const edges = await this.db.getAllEdges(name)

    // Gather deltas (most recent)
    const deltas = await this.db.getDeltas(name)

    return generatePacketMarkdown(name, {
      whiteboard,
      problemVectors,
      nodes,
      edges,
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
            solvedCriteria: data.solvedCriteria,
            problemFacts: data.problemFacts,
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
  async getNodeContents(packetName: string): Promise<NodeContent[]> {
    const deltas = await this.db.getDeltas(packetName)

    // Group deltas by nodeId, excluding vector and whiteboard nodes
    const nodeMap = new Map<string, {
      state: NodeState
      layer?: ZoomLayer
      type?: NodeType
      path?: string
      body: string
    }>()

    for (const d of deltas) {
      if (!d.nodeId) continue
      if (d.nodeId.startsWith(VECTOR_PREFIX)) continue
      if (d.nodeId.startsWith(WHITEBOARD_PREFIX)) continue

      // Determine state from delta type
      let state: NodeState = 'active'
      if (d.type === 'success' || d.type === 'promotion') state = 'success'
      else if (d.type === 'failure') state = 'failed'

      // Try to parse structured metadata from JSON content
      let body = d.content
      let layer: ZoomLayer | undefined
      let nodeType: NodeType | undefined
      let path: string | undefined
      try {
        const parsed = JSON.parse(d.content)
        if (parsed.content) {
          body = parsed.content
          layer = parsed.layer
          nodeType = parsed.type
          path = parsed.path
        }
      } catch {
        // Not JSON, use raw content
      }

      // Preserve type/path from previous deltas if not overridden
      const existing = nodeMap.get(d.nodeId)
      nodeMap.set(d.nodeId, {
        state,
        layer: layer ?? existing?.layer,
        type: nodeType ?? existing?.type,
        path: path ?? existing?.path,
        body,
      })
    }

    const nodes: NodeContent[] = []
    for (const [id, data] of nodeMap) {
      nodes.push({
        id,
        state: data.state,
        type: data.type,
        path: data.path,
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
