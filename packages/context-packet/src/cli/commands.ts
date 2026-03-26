// ============================================================================
// CLI Commands — Command handlers for the `packet` CLI
// ============================================================================

import type { PacketEngine } from '../PacketEngine.js'
import type { PacketDatabase } from '../storage/PacketDatabase.js'
import type { DeltaType, NodeState, NodeType, ZoomLayer } from '../types.js'

const USAGE = `Usage: packet <command> [options]

Commands:
  init [--update]                              Set up Claude Code integration
  seed --name <name> [--plan <file>]           Create a new packet
  list                                         List all packets
  active [<name>]                              Get or set the active packet
  archive <name>                               Archive a packet
  context                                      Output compact packet context (fast, no DB)
  snapshot                                     Re-materialize active packet to file

  node update <id> --state <state> [--layer <layer>] --content <content>
  node promote <id>                            Promote a node to success
  node fail <id> --tried <desc> --reason <desc>
  node list [--state <state>]                  List nodes (from deltas)

  whiteboard update --section <name> --content <mermaid>
  whiteboard list                              List whiteboard sections

  vector update <id> --current <desc> --target <desc> --approach <desc>
  vector resolve <id>                          Resolve a vector
  vector fail <id> --tried <desc> --reason <desc>
  vector list                                  List vectors
  vector criterion add <vecId> --text <text> [--type solved|fact] [--mark <mark>]
  vector criterion update <vecId> <index> --mark <proven|pending|failed|established|gap>

  delta append --node <id> --type <type> --content <desc>
  delta list [--since <timestamp>]             List deltas

  edge add <source> <target>                   Add an edge between two nodes
  edge remove <source> <target>                Remove an edge
  edge list [<nodeId>]                         List edges (optionally for a node)

  attach <work-node> --ref <path> [--id <id>]  Attach a reference node
  attach <work-node> --test <path> [--id <id>] Attach a test node
  attach <work-node> --diagram <mermaid> [--id <id>] Attach a diagram node

  compile status                                Compilation completeness summary
  compile verify                                Human-readable summary for review gate

  collapse <nodeId>                            Collapse deltas for a node
  slice --nodes <id1,id2,...>                   Slice packet for subagent distribution
  inject [--file <path>]                       Get injection content for CLAUDE.md
  docs materialize                             Materialize packet to file
`

// ── Arg Parser ────────────────────────────────────────────────────────────

export interface ParsedArgs {
  flags: Record<string, string>
  positional: string[]
}

export function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string> = {}
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = 'true'
      }
    } else {
      positional.push(args[i])
    }
  }

  return { flags, positional }
}

// ── Command Router ────────────────────────────────────────────────────────

export async function runCommand(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const [command, subcommand, ...rest] = args

  switch (command) {
    case 'seed': return handleSeed(engine, [subcommand, ...rest].filter(Boolean))
    case 'list': return handleList(db)
    case 'active': return handleActive(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'archive': return handleArchive(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'snapshot': return handleSnapshot(engine, db)
    case 'node': return handleNode(engine, db, subcommand, rest)
    case 'whiteboard': return handleWhiteboard(engine, db, subcommand, rest)
    case 'vector': return handleVector(engine, db, subcommand, rest)
    case 'delta': return handleDelta(engine, db, subcommand, rest)
    case 'edge': return handleEdge(engine, db, subcommand, rest)
    case 'attach': return handleAttach(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'compile': return handleCompile(engine, db, subcommand, rest)
    case 'collapse': return handleCollapse(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'slice': return handleSlice(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'inject': return handleInject(engine, [subcommand, ...rest].filter(Boolean))
    case 'docs': return handleDocs(engine, db, subcommand, rest)
    default:
      console.log(USAGE)
      if (command) {
        throw new Error(`Unknown command: ${command}`)
      }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function requireActivePacket(db: PacketDatabase): Promise<string> {
  const active = await db.getActivePacket()
  if (!active) {
    throw new Error('No active packet. Set one with: packet active <name>')
  }
  return active
}

// ── Command Handlers ─────────────────────────────────────────────────────

async function handleSeed(engine: PacketEngine, args: string[]): Promise<void> {
  const { flags } = parseArgs(args)
  const name = flags['name']
  if (!name) {
    throw new Error('--name is required for seed command')
  }

  await engine.seed(name, {
    planFileRef: flags['plan'],
  })

  console.log(JSON.stringify({ status: 'created', name }))
}

async function handleList(db: PacketDatabase): Promise<void> {
  const packets = await db.listPackets()
  const active = await db.getActivePacket()

  const output = packets.map(p => ({
    name: p.name,
    active: p.name === active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    planFileRef: p.planFileRef,
    tags: p.tags,
  }))

  console.log(JSON.stringify(output, null, 2))
}

async function handleActive(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const { positional } = parseArgs(args)
  const name = positional[0]

  if (name) {
    await db.setActivePacket(name)
    await engine.syncActiveMarker(name)
    console.log(JSON.stringify({ status: 'active', name }))
  } else {
    const active = await db.getActivePacket()
    if (active) {
      console.log(JSON.stringify({ active }))
    } else {
      console.log(JSON.stringify({ active: null }))
    }
  }
}

async function handleArchive(
  engine: PacketEngine,
  _db: PacketDatabase,
  args: string[],
): Promise<void> {
  const { positional } = parseArgs(args)
  const name = positional[0]
  if (!name) {
    throw new Error('Archive requires a packet name')
  }

  await engine.archive(name)
  console.log(JSON.stringify({ status: 'archived', name }))
}

async function handleNode(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('node requires a subcommand: update, promote, fail, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'update': {
      const { positional, flags } = parseArgs(rest)
      const nodeId = positional[0]
      if (!nodeId) throw new Error('node update requires a node ID')
      const state = flags['state'] as NodeState
      if (!state) throw new Error('node update requires --state')
      const content = flags['content']
      if (!content) throw new Error('node update requires --content')
      const layer = flags['layer'] as ZoomLayer | undefined

      await engine.nodeUpdate(packetName, nodeId, state, content, layer)
      console.log(JSON.stringify({ status: 'updated', nodeId, state }))
      break
    }
    case 'promote': {
      const { positional } = parseArgs(rest)
      const nodeId = positional[0]
      if (!nodeId) throw new Error('node promote requires a node ID')

      await engine.nodePromote(packetName, nodeId)
      console.log(JSON.stringify({ status: 'promoted', nodeId }))
      break
    }
    case 'fail': {
      const { positional, flags } = parseArgs(rest)
      const nodeId = positional[0]
      if (!nodeId) throw new Error('node fail requires a node ID')
      const tried = flags['tried']
      if (!tried) throw new Error('node fail requires --tried')
      const reason = flags['reason']
      if (!reason) throw new Error('node fail requires --reason')

      await engine.nodeFail(packetName, nodeId, tried, reason)
      console.log(JSON.stringify({ status: 'failed', nodeId }))
      break
    }
    case 'list': {
      const { flags } = parseArgs(rest)
      const stateFilter = flags['state'] as NodeState | undefined

      // Get deltas and build node map
      const deltas = await db.getDeltas(packetName)
      const nodeMap = new Map<string, { state: NodeState; lastContent: string }>()

      for (const d of deltas) {
        if (!d.nodeId) continue
        if (d.nodeId.startsWith('vector:')) continue
        if (d.nodeId.startsWith('whiteboard:')) continue

        let state: NodeState = 'active'
        if (d.type === 'success' || d.type === 'promotion') state = 'success'
        else if (d.type === 'failure') state = 'failed'

        nodeMap.set(d.nodeId, { state, lastContent: d.content })
      }

      const nodes = Array.from(nodeMap.entries())
        .filter(([, data]) => !stateFilter || data.state === stateFilter)
        .map(([id, data]) => ({ id, state: data.state, lastContent: data.lastContent }))

      console.log(JSON.stringify(nodes, null, 2))
      break
    }
    default:
      throw new Error(`Unknown node subcommand: ${subcommand}`)
  }
}

async function handleWhiteboard(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('whiteboard requires a subcommand: update, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'update': {
      const { flags } = parseArgs(rest)
      const section = flags['section']
      if (!section) throw new Error('whiteboard update requires --section')
      const content = flags['content']
      if (!content) throw new Error('whiteboard update requires --content')

      await engine.whiteboardUpdate(packetName, section, content)
      console.log(JSON.stringify({ status: 'updated', section }))
      break
    }
    case 'list': {
      const deltas = await db.getDeltas(packetName)
      const sections = new Map<string, string>()
      const prefix = 'whiteboard:'

      for (const d of deltas) {
        if (d.nodeId && d.nodeId.startsWith(prefix)) {
          const section = d.nodeId.slice(prefix.length)
          sections.set(section, d.content)
        }
      }

      const output = Array.from(sections.entries()).map(([name, content]) => ({
        section: name,
        content,
      }))

      console.log(JSON.stringify(output, null, 2))
      break
    }
    default:
      throw new Error(`Unknown whiteboard subcommand: ${subcommand}`)
  }
}

async function handleVector(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('vector requires a subcommand: update, resolve, fail, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'update': {
      const { positional, flags } = parseArgs(rest)
      const vectorId = positional[0]
      if (!vectorId) throw new Error('vector update requires a vector ID')
      const current = flags['current']
      if (!current) throw new Error('vector update requires --current')
      const target = flags['target']
      if (!target) throw new Error('vector update requires --target')
      const approach = flags['approach']
      if (!approach) throw new Error('vector update requires --approach')

      await engine.vectorUpdate(packetName, vectorId, current, target, approach)
      console.log(JSON.stringify({ status: 'updated', vectorId }))
      break
    }
    case 'resolve': {
      const { positional } = parseArgs(rest)
      const vectorId = positional[0]
      if (!vectorId) throw new Error('vector resolve requires a vector ID')

      await engine.vectorResolve(packetName, vectorId)
      console.log(JSON.stringify({ status: 'resolved', vectorId }))
      break
    }
    case 'fail': {
      const { positional, flags } = parseArgs(rest)
      const vectorId = positional[0]
      if (!vectorId) throw new Error('vector fail requires a vector ID')
      const tried = flags['tried']
      if (!tried) throw new Error('vector fail requires --tried')
      const reason = flags['reason']
      if (!reason) throw new Error('vector fail requires --reason')

      // Use nodeFail with vector: prefix
      await engine.nodeFail(packetName, `vector:${vectorId}`, tried, reason)
      console.log(JSON.stringify({ status: 'failed', vectorId }))
      break
    }
    case 'list': {
      const deltas = await db.getDeltas(packetName)
      const vectorMap = new Map<string, { current: string; target: string; approach: string; state: string }>()
      const prefix = 'vector:'

      for (const d of deltas) {
        if (d.nodeId && d.nodeId.startsWith(prefix)) {
          const vectorId = d.nodeId.slice(prefix.length)
          try {
            const data = JSON.parse(d.content)
            vectorMap.set(vectorId, {
              current: data.current ?? '',
              target: data.target ?? '',
              approach: data.approach ?? '',
              state: data.state ?? 'active',
            })
          } catch {
            // Non-JSON vector content (e.g. failure message), keep last known state
          }
        }
      }

      const output = Array.from(vectorMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      }))

      console.log(JSON.stringify(output, null, 2))
      break
    }
    case 'criterion': {
      const { positional: cArgs, flags: cFlags } = parseArgs(rest)
      const cSubcommand = cArgs[0]
      const cVectorId = cArgs[1]

      if (!cSubcommand || !cVectorId) {
        throw new Error('vector criterion requires: add|update <vectorId> [--text ...] [--mark ...]')
      }

      if (cSubcommand === 'add') {
        const text = cFlags['text']
        if (!text) throw new Error('vector criterion add requires --text')
        const type = (cFlags['type'] ?? 'solved') as 'solved' | 'fact'
        const mark = cFlags['mark']

        await engine.vectorCriterionAdd(packetName, cVectorId, text, type, mark)
        console.log(JSON.stringify({ status: 'added', vectorId: cVectorId, type }))
      } else if (cSubcommand === 'update') {
        const indexStr = cArgs[2]
        if (!indexStr) throw new Error('vector criterion update requires an index')
        const index = parseInt(indexStr, 10)
        const mark = cFlags['mark']
        if (!mark) throw new Error('vector criterion update requires --mark')
        const type = (cFlags['type'] ?? 'solved') as 'solved' | 'fact'

        await engine.vectorCriterionUpdate(packetName, cVectorId, index, mark, type)
        console.log(JSON.stringify({ status: 'updated', vectorId: cVectorId, index, mark }))
      } else {
        throw new Error(`Unknown criterion subcommand: ${cSubcommand}`)
      }
      break
    }
    default:
      throw new Error(`Unknown vector subcommand: ${subcommand}`)
  }
}

async function handleDelta(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('delta requires a subcommand: append, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'append': {
      const { flags } = parseArgs(rest)
      const nodeId = flags['node']
      const type = flags['type'] as DeltaType
      if (!type) throw new Error('delta append requires --type')
      const content = flags['content']
      if (!content) throw new Error('delta append requires --content')

      await engine.deltaAppend(packetName, nodeId, type, content)
      console.log(JSON.stringify({ status: 'appended', nodeId, type }))
      break
    }
    case 'list': {
      const { flags } = parseArgs(rest)
      const since = flags['since'] ? parseInt(flags['since'], 10) : undefined

      const deltas = await db.getDeltas(packetName, since)
      const output = deltas.map(d => ({
        id: d.id,
        timestamp: d.timestamp,
        nodeId: d.nodeId,
        type: d.type,
        content: d.content,
      }))

      console.log(JSON.stringify(output, null, 2))
      break
    }
    default:
      throw new Error(`Unknown delta subcommand: ${subcommand}`)
  }
}

async function handleEdge(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('edge requires a subcommand: add, remove, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'add': {
      const { positional } = parseArgs(rest)
      const source = positional[0]
      const target = positional[1]
      if (!source || !target) throw new Error('edge add requires <source> <target>')

      const id = await engine.edgeAdd(packetName, source, target)
      console.log(JSON.stringify({ status: 'added', id, source, target }))
      break
    }
    case 'remove': {
      const { positional } = parseArgs(rest)
      const source = positional[0]
      const target = positional[1]
      if (!source || !target) throw new Error('edge remove requires <source> <target>')

      await engine.edgeRemove(packetName, source, target)
      console.log(JSON.stringify({ status: 'removed', source, target }))
      break
    }
    case 'list': {
      const { positional } = parseArgs(rest)
      const nodeId = positional[0]

      const edges = await engine.edgeList(packetName, nodeId)
      const output = edges.map(e => ({
        id: e.id,
        source: e.sourceNode,
        target: e.targetNode,
        createdAt: e.createdAt,
      }))

      console.log(JSON.stringify(output, null, 2))
      break
    }
    default:
      throw new Error(`Unknown edge subcommand: ${subcommand}`)
  }
}

async function handleAttach(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const { positional, flags } = parseArgs(args)
  const workNode = positional[0]
  if (!workNode) {
    throw new Error('attach requires a work node ID')
  }

  const packetName = await requireActivePacket(db)

  // Determine type from flags
  let nodeType: NodeType
  let content: string
  let path: string | undefined
  let autoId: string

  if (flags['ref']) {
    nodeType = 'reference'
    path = flags['ref']
    content = `Reference: ${path}`
    autoId = `ref-${path.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
  } else if (flags['test']) {
    nodeType = 'test'
    path = flags['test']
    content = `Test: ${path}`
    autoId = `test-${path.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
  } else if (flags['diagram']) {
    nodeType = 'diagram'
    content = flags['diagram']
    autoId = `diag-${workNode}`
  } else {
    throw new Error('attach requires --ref <path>, --test <path>, or --diagram <mermaid>')
  }

  const nodeId = flags['id'] ?? autoId

  // Create the typed node
  await engine.nodeUpdate(packetName, nodeId, 'active', content, undefined, nodeType, path)

  // Create the edge from work node to typed node
  await engine.edgeAdd(packetName, workNode, nodeId)

  console.log(JSON.stringify({ status: 'attached', workNode, nodeId, type: nodeType, path }))
}

async function handleCollapse(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const { positional } = parseArgs(args)
  const nodeId = positional[0]
  if (!nodeId) {
    throw new Error('collapse requires a node ID')
  }

  const packetName = await requireActivePacket(db)
  await engine.collapse(packetName, nodeId)
  console.log(JSON.stringify({ status: 'collapsed', nodeId }))
}

async function handleSlice(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const { flags } = parseArgs(args)
  const nodesStr = flags['nodes']
  if (!nodesStr) {
    throw new Error('slice requires --nodes <id1,id2,...>')
  }

  const nodeIds = nodesStr.split(',').map(s => s.trim()).filter(Boolean)
  if (nodeIds.length === 0) {
    throw new Error('No node IDs provided')
  }

  const packetName = await requireActivePacket(db)
  const slice = await engine.sliceForNode(packetName, nodeIds)
  console.log(slice)
}

async function handleInject(
  engine: PacketEngine,
  args: string[],
): Promise<void> {
  const { flags } = parseArgs(args)

  const content = await engine.getInjectionContent()
  if (!content) {
    console.log('No active packet or no injection content available.')
    return
  }

  if (flags['file']) {
    // When --file is provided, output just the content for piping
    console.log(content)
  } else {
    console.log(content)
  }
}

async function handleSnapshot(
  engine: PacketEngine,
  db: PacketDatabase,
): Promise<void> {
  const active = await db.getActivePacket()
  if (!active) return // Silent exit when no active packet

  const path = await engine.materialize(active)
  console.log(JSON.stringify({ status: 'snapshot', name: active, path }))
}

async function handleCompile(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  _rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('compile requires a subcommand: status, verify')
  }

  const packetName = await requireActivePacket(db)
  const deltas = await db.getDeltas(packetName)

  // Count vectors and their criteria
  const vectorMap = new Map<string, {
    current: string; target: string; approach: string; state: string;
    solvedCriteria?: Array<{ text: string; mark: string }>
    problemFacts?: Array<{ text: string; mark: string }>
  }>()
  const nodeMap = new Map<string, { state: NodeState; hasProofFields: boolean }>()
  let compMapCount = 0

  for (const d of deltas) {
    if (!d.nodeId) continue
    if (d.nodeId.startsWith('vector:')) {
      const vectorId = d.nodeId.slice(7)
      try {
        const data = JSON.parse(d.content)
        vectorMap.set(vectorId, data)
      } catch { /* skip */ }
    } else if (d.nodeId.startsWith('whiteboard:')) {
      continue
    } else {
      let state: NodeState = 'active'
      if (d.type === 'success' || d.type === 'promotion') state = 'success'
      else if (d.type === 'failure') state = 'failed'
      // Check if content includes proof fields
      const hasProofFields = d.content.includes('derives-from:') ||
        d.content.includes('proves:') ||
        d.content.includes('claim:')
      nodeMap.set(d.nodeId, { state, hasProofFields })
    }
    // Count comp maps from content
    if (d.content.includes('<comp:map:')) {
      compMapCount++
    }
  }

  // Read materialized packet to count comp maps more accurately
  try {
    const content = await db.getLatestVersion(packetName)
    if (content?.content) {
      const mapMatches = content.content.match(/<comp:map:\w/g)
      if (mapMatches) compMapCount = mapMatches.length
    }
  } catch { /* fallback to delta count */ }

  const totalCriteria = Array.from(vectorMap.values()).reduce((sum, v) =>
    sum + (v.solvedCriteria?.length ?? 0), 0)
  const provenCriteria = Array.from(vectorMap.values()).reduce((sum, v) =>
    sum + (v.solvedCriteria?.filter(c => c.mark === 'proven').length ?? 0), 0)
  const pendingCriteria = totalCriteria - provenCriteria

  const totalFacts = Array.from(vectorMap.values()).reduce((sum, v) =>
    sum + (v.problemFacts?.length ?? 0), 0)
  const gaps = Array.from(vectorMap.values()).reduce((sum, v) =>
    sum + (v.problemFacts?.filter(f => f.mark === 'gap').length ?? 0), 0)

  const totalNodes = nodeMap.size
  const proofSteps = Array.from(nodeMap.values()).filter(n => n.hasProofFields).length
  const activeNodes = Array.from(nodeMap.values()).filter(n => n.state === 'active').length
  const resolvedNodes = Array.from(nodeMap.values()).filter(n => n.state === 'success').length

  switch (subcommand) {
    case 'status': {
      console.log(JSON.stringify({
        vectors: vectorMap.size,
        compMaps: compMapCount,
        criteria: { total: totalCriteria, proven: provenCriteria, pending: pendingCriteria },
        facts: { total: totalFacts, gaps },
        nodes: { total: totalNodes, proofSteps, active: activeNodes, resolved: resolvedNodes },
        coverage: totalCriteria > 0
          ? Math.round((provenCriteria / totalCriteria) * 100)
          : 0,
      }, null, 2))
      break
    }
    case 'verify': {
      const lines: string[] = []
      lines.push('## Compilation Summary')
      lines.push('')
      lines.push(`**Vectors:** ${vectorMap.size}`)
      lines.push(`**Compression Maps:** ${compMapCount}`)
      lines.push('')

      lines.push('### Solved Criteria')
      for (const [vecId, vec] of vectorMap) {
        if (vec.solvedCriteria && vec.solvedCriteria.length > 0) {
          lines.push(`**${vecId}:**`)
          for (const c of vec.solvedCriteria) {
            const icon = c.mark === 'proven' ? '✓' : c.mark === 'failed' ? '✗' : '○'
            lines.push(`  ${icon} ${c.text}`)
          }
        }
      }
      if (totalCriteria === 0) lines.push('  (none defined)')
      lines.push('')

      lines.push('### Problem Facts')
      for (const [vecId, vec] of vectorMap) {
        if (vec.problemFacts && vec.problemFacts.length > 0) {
          lines.push(`**${vecId}:**`)
          for (const f of vec.problemFacts) {
            const icon = f.mark === 'gap' ? '⊘' : '●'
            lines.push(`  ${icon} ${f.text}`)
          }
        }
      }
      if (totalFacts === 0) lines.push('  (none defined)')
      lines.push('')

      lines.push('### Proof Steps')
      lines.push(`  ${proofSteps} proof steps / ${totalNodes} total nodes`)
      lines.push(`  ${activeNodes} active / ${resolvedNodes} resolved`)
      lines.push('')

      lines.push(`### Coverage: ${totalCriteria > 0 ? Math.round((provenCriteria / totalCriteria) * 100) : 0}%`)
      lines.push(`  ${provenCriteria}/${totalCriteria} criteria proven`)
      if (gaps > 0) lines.push(`  ${gaps} gaps remaining`)

      console.log(lines.join('\n'))
      break
    }
    default:
      throw new Error(`Unknown compile subcommand: ${subcommand}`)
  }
}

async function handleDocs(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  _rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('docs requires a subcommand: materialize')
  }

  switch (subcommand) {
    case 'materialize': {
      const packetName = await requireActivePacket(db)
      const path = await engine.materialize(packetName)
      console.log(JSON.stringify({ status: 'materialized', path }))
      break
    }
    default:
      throw new Error(`Unknown docs subcommand: ${subcommand}`)
  }
}
