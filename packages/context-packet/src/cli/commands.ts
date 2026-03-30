// ============================================================================
// CLI Commands — Command handlers for the `packet` CLI
// ============================================================================

import type { PacketEngine } from '../PacketEngine.js'
import type { PacketDatabase } from '../storage/PacketDatabase.js'
import type { DeltaType, NodeState, NodeType } from '../types.js'
import { runTests, type TestRunSummary } from '../testRunner.js'

const USAGE = `Usage: packet <command> [options]

Commands:
  init [--update]                              Set up Claude Code integration
  seed --name <name> [--plan <file>]           Create a new packet
  list                                         List all packets
  active [<name>]                              Get or set the active packet
  archive <name>                               Archive a packet
  context                                      Output compact packet context (fast, no DB)
  snapshot                                     Re-materialize active packet to file

  node update <id> --state <state> --content <content>
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

  doc create <path> [--node <id>] [--content <text>]  Create a named artifact
  doc write <path> [--node <id>]                 Write/update artifact (validates against workflow gates)
  doc list                                       List artifacts in the packet
  doc read <path>                                Read an artifact
  doc link <path> --node <id>                    Link an artifact to a node

  capture --files <paths> [--commit <hash> --message <msg>]
                                                Route file changes to work nodes via ref edges
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
    case 'collapse': return handleCollapse(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'slice': return handleSlice(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'inject': return handleInject(engine, [subcommand, ...rest].filter(Boolean))
    case 'docs': return handleDocs(engine, db, subcommand, rest)
    case 'capture': return handleCapture(engine, db, [subcommand, ...rest].filter(Boolean))
    case 'doc': return handleDoc(engine, db, subcommand, rest)
    case 'workflow': return handleWorkflow(engine, db, rest)
    case 'lesson': return handleLesson(engine, db, subcommand, rest)
    case 'template': return handleTemplate(engine, rest)
    case 'questions': return handleQuestions(engine, db, subcommand, rest)
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
    template: flags['template'],
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

      await engine.nodeUpdate(packetName, nodeId, state, content)
      console.log(JSON.stringify({ status: 'updated', nodeId, state }))
      break
    }
    case 'promote': {
      const { positional, flags } = parseArgs(rest)
      const nodeId = positional[0]
      if (!nodeId) throw new Error('node promote requires a node ID')

      // Before promoting, find and run connected test nodes
      const skipTests = flags['skip-tests'] === 'true'
      let testSummary: TestRunSummary | null = null

      if (!skipTests) {
        testSummary = await runConnectedTests(engine, db, packetName, nodeId)
      }

      await engine.nodePromote(packetName, nodeId)

      const result: Record<string, unknown> = { status: 'promoted', nodeId }
      if (testSummary) {
        result.tests = {
          allPassed: testSummary.allPassed,
          summary: testSummary.summary,
          results: testSummary.results.map(r => ({
            path: r.path,
            passed: r.passed,
            failed: r.failed,
            summary: r.summary,
          })),
        }
      }
      console.log(JSON.stringify(result))
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

    // Extract section from path#section syntax
    const hashIdx = path.indexOf('#')
    const externalPath = hashIdx >= 0 ? path.slice(0, hashIdx) : path
    const section = hashIdx >= 0 ? path.slice(hashIdx + 1) : undefined

    // Create reference fragment inside packet directory
    const refsPath = await engine.createRefFragment(packetName, externalPath, section)

    content = `Reference: ${path} → ${refsPath}`
    autoId = `ref-${externalPath.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
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
  await engine.nodeUpdate(packetName, nodeId, 'active', content, nodeType, path)

  // Create the edge from work node to typed node
  await engine.edgeAdd(packetName, workNode, nodeId)

  console.log(JSON.stringify({ status: 'attached', workNode, nodeId, type: nodeType, path }))
}

/**
 * Find test-type nodes connected to a work node, run them,
 * and record results as deltas.
 */
async function runConnectedTests(
  engine: PacketEngine,
  db: PacketDatabase,
  packetName: string,
  nodeId: string,
): Promise<TestRunSummary | null> {
  // Get all edges for this node
  const edges = await engine.edgeList(packetName, nodeId)
  if (edges.length === 0) return null

  // Find connected nodes that are test-type
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.sourceNode === nodeId ? edge.targetNode : edge.sourceNode)
  }

  // Get node contents to check types
  const nodeContents = await engine.getNodeContents(packetName)
  const testPaths: string[] = []

  for (const node of nodeContents) {
    if (!connectedNodeIds.has(node.id)) continue
    if (node.type !== 'test') continue
    if (node.path) testPaths.push(node.path)
  }

  if (testPaths.length === 0) return null

  // Determine project root (cwd for running tests)
  const cwd = process.cwd()

  // Run the tests
  const summary = runTests(testPaths, cwd)

  // Record results as deltas on the work node
  for (const result of summary.results) {
    const deltaType: DeltaType = result.failed > 0 ? 'failure' : 'success'
    await db.appendDelta(packetName, {
      nodeId,
      type: deltaType,
      content: `Test ${result.path}: ${result.summary}`,
    })
  }

  return summary
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

/**
 * Capture file changes and route them to work nodes via reference edges.
 * Usage: packet capture --files <path1,path2,...> [--commit <hash> --message <msg>]
 */
async function handleCapture(
  engine: PacketEngine,
  db: PacketDatabase,
  args: string[],
): Promise<void> {
  const packetName = await requireActivePacket(db)
  const { flags } = parseArgs(args)

  const filesRaw = flags['files']
  if (!filesRaw) {
    throw new Error('capture requires --files <comma-separated-paths>')
  }
  const files = filesRaw.split(',').map(f => f.trim()).filter(Boolean)

  const commitHash = flags['commit']
  const commitMessage = flags['message']
  const commitInfo = commitHash && commitMessage
    ? { hash: commitHash, message: commitMessage }
    : undefined

  const count = await engine.routeFileChanges(packetName, files, commitInfo)
  console.log(JSON.stringify({ status: 'captured', filesRouted: count, totalFiles: files.length }))
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

/**
 * Manage named document artifacts inside the packet directory.
 * Usage:
 *   packet doc create <path> [--node <nodeId>] [--content <text>]
 *   packet doc list
 *   packet doc read <path>
 *   packet doc link <path> --node <nodeId>
 */
async function handleDoc(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('doc requires a subcommand: create, list, read, link')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'create': {
      const { positional, flags } = parseArgs(rest)
      const docPath = positional[0]
      if (!docPath) throw new Error('doc create requires a path (e.g. design/auth-architecture)')

      // Auto-add .md extension if not present
      const finalPath = docPath.endsWith('.md') ? docPath : `${docPath}.md`
      const content = flags['content']
      const nodeId = flags['node']

      const fullPath = await engine.docCreate(packetName, finalPath, content, nodeId)
      console.log(JSON.stringify({ status: 'created', path: finalPath, fullPath, nodeId: nodeId ?? null }))
      break
    }
    case 'write': {
      const { positional, flags } = parseArgs(rest)
      const writePath = positional[0]
      if (!writePath) throw new Error('doc write requires a path')

      // Read content from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer)
      }
      const writeContent = Buffer.concat(chunks).toString('utf-8')

      const nodeId = flags['node']
      const result = await engine.docWrite(packetName, writePath, writeContent, nodeId)

      if (result.validationErrors.length > 0) {
        console.log(JSON.stringify({
          status: 'written_with_errors',
          path: writePath,
          validationErrors: result.validationErrors,
        }))
      } else {
        console.log(JSON.stringify({
          status: 'valid',
          path: writePath,
        }))
      }
      break
    }
    case 'list': {
      const docs = await engine.docList(packetName)
      console.log(JSON.stringify(docs, null, 2))
      break
    }
    case 'read': {
      const { positional } = parseArgs(rest)
      const docPath = positional[0]
      if (!docPath) throw new Error('doc read requires a path')

      const content = await engine.docRead(packetName, docPath)
      console.log(content)
      break
    }
    case 'link': {
      const { positional, flags } = parseArgs(rest)
      const docPath = positional[0]
      if (!docPath) throw new Error('doc link requires a path')
      const nodeId = flags['node']
      if (!nodeId) throw new Error('doc link requires --node <nodeId>')

      await engine.docLink(packetName, docPath, nodeId)
      console.log(JSON.stringify({ status: 'linked', path: docPath, nodeId }))
      break
    }
    default:
      throw new Error(`Unknown doc subcommand: ${subcommand}`)
  }
}

async function handleWorkflow(
  engine: PacketEngine,
  db: PacketDatabase,
  rest: string[],
): Promise<void> {
  const packetName = await requireActivePacket(db)
  const { positional } = parseArgs(rest)
  const subcommand = positional[0] ?? 'status'

  switch (subcommand) {
    case 'status': {
      const statuses = await engine.getWorkflowStatus(packetName)
      if (statuses.length === 0) {
        console.log(JSON.stringify({ error: 'No workflow.md found in packet' }))
        return
      }
      console.log(JSON.stringify(statuses, null, 2))
      break
    }
    default:
      throw new Error(`Unknown workflow subcommand: ${subcommand}`)
  }
}

async function handleLesson(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  if (!subcommand) {
    throw new Error('lesson requires a subcommand: add, list')
  }

  const packetName = await requireActivePacket(db)

  switch (subcommand) {
    case 'add': {
      const { flags } = parseArgs(rest)
      const content = flags['content']
      if (!content) throw new Error('lesson add requires --content')

      await engine.lessonAdd(packetName, content)
      console.log(JSON.stringify({ status: 'added' }))
      break
    }
    case 'list': {
      const lessons = await engine.lessonList(packetName)
      console.log(JSON.stringify(lessons, null, 2))
      break
    }
    default:
      throw new Error(`Unknown lesson subcommand: ${subcommand}`)
  }
}

async function handleTemplate(
  engine: PacketEngine,
  rest: string[],
): Promise<void> {
  const { positional } = parseArgs(rest)
  const subcommand = positional[0] ?? 'list'

  switch (subcommand) {
    case 'list': {
      const templates = await engine.listTemplates()
      console.log(JSON.stringify(templates, null, 2))
      break
    }
    default:
      throw new Error(`Unknown template subcommand: ${subcommand}`)
  }
}

async function handleQuestions(
  engine: PacketEngine,
  db: PacketDatabase,
  subcommand: string | undefined,
  rest: string[],
): Promise<void> {
  const packetName = await requireActivePacket(db)

  switch (subcommand ?? 'list') {
    case 'list': {
      const questions = await engine.scanQuestions(packetName)
      console.log(JSON.stringify(questions, null, 2))
      break
    }
    default:
      throw new Error(`Unknown questions subcommand: ${subcommand}`)
  }
}
