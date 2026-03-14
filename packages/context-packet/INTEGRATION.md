# Context-Towel Integration Guide

Reference for host apps (Felix, Looking Glass, etc.) that import context-towel packages.

---

## 1. PacketDatabase Adapter

The packet system stores versioned context data (deltas, keyframes, patterns, metadata) through the `PacketDatabase` interface. The host app must provide an implementation.

### Interface

```typescript
import type { PacketDatabase } from '@context-towel/context-packet'
```

Key methods:

| Group | Methods |
|-------|---------|
| Versions | `writeVersion`, `getVersions`, `getVersion`, `getLatestVersion` |
| Deltas | `appendDelta`, `getDeltas`, `getDeltasForNode` |
| Keyframes | `writeKeyframe`, `getKeyframes`, `getLatestKeyframe` |
| Patterns | `writePattern`, `findPatterns`, `getAllPatterns`, `incrementConfidence` |
| Metadata | `getPacketMeta`, `setPacketMeta`, `listPackets`, `deletePacket` |
| Active | `getActivePacket`, `setActivePacket` |

Full interface: `packages/context-packet/src/storage/PacketDatabase.ts`

### Option A: Use the shipped sql.js adapter

`SqljsPacketDatabase` uses sql.js (SQLite compiled to WASM). Works in Node.js and browsers.

```typescript
import { SqljsPacketDatabase } from '@context-towel/context-packet'

// Async (auto-initializes sql.js WASM):
const db = await SqljsPacketDatabase.create()

// From existing data (e.g. loaded from disk):
const data = new Uint8Array(await fs.readFile('.context/db/context.db'))
const db = await SqljsPacketDatabase.open(data)

// Sync variants (if you pre-initialize sql.js yourself):
import initSqlJs from 'sql.js'
const SQL = await initSqlJs()
const db = SqljsPacketDatabase.createSync(SQL)
const db = SqljsPacketDatabase.openSync(SQL, existingData)

// Persist to disk:
const bytes = db.export() // Uint8Array
await fs.writeFile('.context/db/context.db', Buffer.from(bytes))

// Cleanup:
db.close()
```

### Option B: Custom adapter (e.g. Tauri SQL plugin)

Implement `PacketDatabase` against your native SQLite binding. Use the sql.js schema as reference:

```sql
CREATE TABLE IF NOT EXISTS packet_meta (
  name TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  active_packet INTEGER DEFAULT 0,
  plan_file_ref TEXT,
  tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  content TEXT NOT NULL,
  delta_from_prev TEXT,
  FOREIGN KEY (packet_name) REFERENCES packet_meta(name)
);

CREATE TABLE IF NOT EXISTS deltas (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  node_id TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (packet_name) REFERENCES packet_meta(name)
);

CREATE TABLE IF NOT EXISTS keyframes (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  trigger_node_id TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (packet_name) REFERENCES packet_meta(name)
);

CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  subsystem TEXT NOT NULL,
  codebase TEXT,
  content TEXT NOT NULL,
  source_packet TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 1
);
```

### Option C: InMemoryPacketDatabase (testing)

```typescript
import { InMemoryPacketDatabase } from '@context-towel/context-packet'
const db = new InMemoryPacketDatabase()
```

No persistence. Useful for tests and ephemeral sessions.

---

## 2. PacketWorkspace Component

Visual canvas that renders a context packet's diagrams, tasks, and metadata as an interactive workspace.

### Import

```typescript
import { PacketWorkspace } from '@context-towel/context-graph/embed'
// or from the main entrypoint:
import { PacketWorkspace } from '@context-towel/context-graph'
```

### Props

```typescript
interface PacketWorkspaceProps {
  /** The packet markdown content (from .context/current/{name}.md) */
  packetContent: string
  /** Display name of the packet */
  packetName: string
  /** File path (for source links / AI reference) */
  packetPath: string
  /** Parsed session log entries (optional, falls back to parsing from markdown) */
  history?: Array<{ timestamp: string; entry: string }>
  /** Callback when user clicks a source reference */
  onOpenSource?: (file: string, line?: number) => void
  /** Callback for content saves (future inline editing) */
  onSave?: (content: string) => void
  /** Whether the workspace is visible (skip rendering when hidden) */
  isVisible?: boolean
}
```

### Usage

```tsx
import { PacketWorkspace } from '@context-towel/context-graph/embed'

function PacketPanel({ packetName, engine }: Props) {
  const [content, setContent] = useState('')

  useEffect(() => {
    engine.materialize(packetName).then(async (filePath) => {
      setContent(await fs.readFile(filePath, 'utf-8'))
    })
  }, [packetName])

  return (
    <PacketWorkspace
      packetContent={content}
      packetName={packetName}
      packetPath={`.context/current/${packetName}.md`}
      onOpenSource={(file, line) => editor.open(file, line)}
      isVisible={true}
    />
  )
}
```

### Peer dependencies

The host must provide `react` (18+ or 19+) and `react-dom`. The `@xyflow/react` dependency is bundled into context-graph's output -- the host does not need to install it separately.

---

## 3. CLI Setup for Agent Access

The `packet` binary provides a CLI for AI agents and scripts to interact with the packet system.

### Binary location

```
packages/context-packet/dist/cli/index.js
```

Declared in `package.json` as `"bin": { "packet": "./dist/cli/index.js" }`.

### Running

```bash
# If context-packet is linked / installed globally:
packet <command> [options]

# Via npx from the monorepo:
npx @context-towel/context-packet packet <command>

# Direct execution:
node packages/context-packet/dist/cli/index.js <command>
```

The CLI operates on the `.context/` directory relative to `process.cwd()`. Database path: `.context/db/context.db`.

### Commands reference

**Packet lifecycle:**
| Command | Description |
|---------|-------------|
| `seed --name <name> [--plan <file>]` | Create a new packet |
| `list` | List all packets (JSON) |
| `active [<name>]` | Get or set the active packet |
| `archive <name>` | Archive a packet (extract patterns, move to archive/) |

**Node operations** (require an active packet):
| Command | Description |
|---------|-------------|
| `node update <id> --state <state> [--layer <layer>] --content <content>` | Create/update a node |
| `node promote <id>` | Promote node to success (collapse + keyframe) |
| `node fail <id> --tried <desc> --reason <desc>` | Mark node as failed |
| `node list [--state <state>]` | List nodes from delta chain |

**Whiteboard operations** (require an active packet):
| Command | Description |
|---------|-------------|
| `whiteboard update --section <name> --content <mermaid>` | Update a whiteboard section |
| `whiteboard list` | List whiteboard sections |

**Vector operations** (require an active packet):
| Command | Description |
|---------|-------------|
| `vector update <id> --current <desc> --target <desc> --approach <desc>` | Update a problem vector |
| `vector resolve <id>` | Resolve a vector (mark success + keyframe) |
| `vector fail <id> --tried <desc> --reason <desc>` | Mark vector as failed |
| `vector list` | List all vectors |

**Delta operations** (require an active packet):
| Command | Description |
|---------|-------------|
| `delta append --node <id> --type <type> --content <desc>` | Append a raw delta |
| `delta list [--since <timestamp>]` | List deltas |

**Other:**
| Command | Description |
|---------|-------------|
| `collapse <nodeId>` | Collapse delta chain for a node into a keyframe |
| `inject [--file <path>]` | Output CLAUDE.md injection content for the active packet |
| `docs materialize` | Materialize active packet to `.context/current/{name}.md` |

Valid `--state` values: `active`, `success`, `failed`
Valid `--type` values: `discovery`, `failure`, `success`, `promotion`, `collapse`
Valid `--layer` values: `continent`, `region`, `district`, `street`, `ground`

All commands output JSON to stdout.

---

## 4. AutoWriter Configuration

The auto-writer watches the graph store and syncs instruction files (CLAUDE.md, AGENTS.md, GEMINI.md) whenever workspace state changes.

### Import

```typescript
import {
  createInstructionAutoWriter,
  configurePacketService,
} from '@context-towel/context-graph'

import type {
  InstructionWriterDeps,
  PacketServiceInterface,
} from '@context-towel/context-graph'
```

### PacketServiceInterface

The auto-writer uses `PacketServiceInterface` to get active packet content for CLAUDE.md injection. Back it with `PacketEngine`:

```typescript
import type { PacketServiceInterface } from '@context-towel/context-graph'
import { PacketEngine, SqljsPacketDatabase } from '@context-towel/context-packet'
import type { FileService } from '@context-towel/context-packet'

function createPacketServiceFromEngine(
  engine: PacketEngine,
  db: PacketDatabase,
  fs: FileService,
): PacketServiceInterface {
  return {
    async load(name) {
      const version = await db.getLatestVersion(name)
      return version?.content ?? null
    },
    async save(name, content) {
      // Write content to materialized file
      const path = engine.getPacketPath(name)
      await fs.write(path, content)
    },
    async list() {
      const packets = await db.listPackets()
      return packets.map(p => ({
        name: p.name,
        createdAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt).toISOString(),
      }))
    },
    async getActive() {
      return db.getActivePacket()
    },
    async setActive(name) {
      await db.setActivePacket(name)
    },
    async create(name, opts) {
      await engine.seed(name, { planFileRef: opts?.planFileRef })
      await db.setActivePacket(name)
      return name
    },
    async appendLog(name, entry) {
      await engine.deltaAppend(name, undefined, 'discovery', entry)
    },
    async getPacketContent() {
      return engine.getInjectionContent()
    },
    async archive(name) {
      await engine.archive(name)
    },
    async getHistory(name) {
      const versions = await db.getVersions(name)
      return versions.map(v => ({
        timestamp: new Date(v.timestamp).toISOString(),
        path: engine.getPacketPath(name),
      }))
    },
    async loadSnapshot(name, timestamp) {
      const versions = await db.getVersions(name)
      const ts = new Date(timestamp).getTime()
      const match = versions.find(v => v.timestamp === ts)
      return match?.content ?? null
    },
  }
}
```

### Wiring the auto-writer

```typescript
import { configurePacketService, createInstructionAutoWriter } from '@context-towel/context-graph'
import { configureCompatServices } from '@context-towel/context-graph/compat/services'

// 1. Configure services (file service must implement FileServiceInterface)
configureCompatServices({ fileService: myFileService })
configurePacketService(myPacketService)

// 2. Create the auto-writer
const writer = createInstructionAutoWriter({
  fileService: myFileService,   // Pick<FileServiceInterface, 'exists' | 'read' | 'write'>
  packetService: myPacketService,
  getTargets: (projectPath) => [
    { path: `${projectPath}/CLAUDE.md`, kind: 'claude' },
    { path: `${projectPath}/AGENTS.md`, kind: 'agents' },
    { path: `${projectPath}/GEMINI.md`, kind: 'gemini' },
  ],
  createMissing: false,  // don't create files that don't exist yet
  debounceMs: 900,       // debounce writes (default 900ms)
})

// 3. Start watching (returns a dispose function)
const dispose = writer.start('/path/to/project')

// 4. Stop when done
dispose()
```

The auto-writer subscribes to `useGraphStore` and syncs instruction files whenever relevant state changes (documents, focus, panels, packet, etc.).

---

## 5. Package Exports Summary

### @context-towel/context-packet

```typescript
// Engine
import { PacketEngine } from '@context-towel/context-packet'

// Storage adapters
import type { PacketDatabase } from '@context-towel/context-packet'
import { InMemoryPacketDatabase, SqljsPacketDatabase } from '@context-towel/context-packet'

// Types
import type {
  VersionTrigger,      // 'delta' | 'keyframe' | 'collapse'
  DeltaType,           // 'discovery' | 'failure' | 'success' | 'promotion' | 'collapse'
  NodeState,           // 'active' | 'success' | 'failed'
  ZoomLayer,           // 'continent' | 'region' | 'district' | 'street' | 'ground'
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  ProblemVector,
  CreatePacketOptions,
  FileService,
} from '@context-towel/context-packet'

// Template generation
import { generatePacketMarkdown } from '@context-towel/context-packet'
import type { ProblemVectorState, NodeContent, GeneratePacketOptions } from '@context-towel/context-packet'

// CLAUDE.md injection
import {
  extractProblemVectors,
  formatInjectionContent,
  injectPacketIntoContent,
  removePacketSection,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
} from '@context-towel/context-packet'

// Docs (AICCL)
import { materializeDocs, generateRootIndex, generateSubsystemIndex } from '@context-towel/context-packet'
import { renderPatternAsHuman, renderSubsystemDocs } from '@context-towel/context-packet'

// Task sync
import type { TaskSyncData, TaskSyncResult } from '@context-towel/context-packet'
import {
  serializeTaskBlock,
  findTaskBlockById,
  extractTaskBlocks,
  buildTaskSourceMap,
  syncTaskToSourceFile,
} from '@context-towel/context-packet'

// Workflow instructions
import { PACKET_WORKFLOW_INSTRUCTIONS, generateWorkflowSection } from '@context-towel/context-packet'
```

### @context-towel/context-graph

Entrypoints: `.` (full), `./graph`, `./embed`, `./channel`, `./types`, `./compat/services`, `./compat/design-system`

```typescript
// Packet workspace (visual canvas)
import { PacketWorkspace } from '@context-towel/context-graph'
// or: import { PacketWorkspace } from '@context-towel/context-graph/embed'
import type { PacketWorkspaceProps, SessionLogEntry } from '@context-towel/context-graph'

// Generic workspace board
import { WorkspaceBoard } from '@context-towel/context-graph'
import type { WorkspaceBoardProps, WorkspaceContentItem, WorkspaceHistoryEntry } from '@context-towel/context-graph'

// Packet service configuration
import {
  configurePacketService,
  resetPacketService,
  noopPacketService,
} from '@context-towel/context-graph'
import type { PacketServiceInterface } from '@context-towel/context-graph'

// Auto-writer
import { createInstructionAutoWriter, syncInstructionFiles } from '@context-towel/context-graph'
import type { InstructionWriterDeps, InstructionTarget } from '@context-towel/context-graph'

// Compat services (file service, file parser)
import { configureCompatServices, resetCompatServices } from '@context-towel/context-graph/compat/services'
import type { FileServiceInterface, PacketServiceInterface } from '@context-towel/context-graph/compat/services'

// State management
import { useGraphStore, getStoreSnapshot, resetStore } from '@context-towel/context-graph'
import type { StoreState, ParsedDocContent } from '@context-towel/context-graph'

// Context generation
import { generateClaudeMd, generateAgentsMd } from '@context-towel/context-graph'

// Plugin system
import { pluginRegistry, registerBuiltinPlugins, parseDocument } from '@context-towel/context-graph'

// Graph components
import { ContextGraphPanel, DocumentGraph, ContextGraphView } from '@context-towel/context-graph'
import { ContextGraph } from '@context-towel/context-graph/embed'
```

### @context-towel/card-library

```typescript
// Node card (AICCL node rendering)
import { NodeCard, nodeBlockDefinition, registerNodeBlock } from '@context-towel/card-library'
import type { NodeBlockData, NodeState, ZoomLayer } from '@context-towel/card-library'

// Node map card
import { registerNodeMapBlock, nodeMapBlockDefinition } from '@context-towel/card-library'
import type { NodeMapBlockData } from '@context-towel/card-library'

// Block system
import { blockRegistry, registerCoreBlocks, registerAllCardPlugins } from '@context-towel/card-library'
import { parseMarkdownBlocks, validateBlockYaml } from '@context-towel/card-library'
import { toRuntimeBlock, toRuntimeBlocks } from '@context-towel/card-library'
import type { BlockDefinition, BlockInstance, BlockRuntime } from '@context-towel/card-library'

// Rendering
import { CardRenderer, CardListRenderer, CardThemeProvider } from '@context-towel/card-library'
import type { CardRendererProps, CardListRendererProps, CardHost } from '@context-towel/card-library'

// Persistence
import {
  serializeBlockData,
  replaceBlockInMarkdown,
  updateBlockInMarkdown,
} from '@context-towel/card-library'

// Task cards
import { TaskCard, registerTaskBlock, taskBlockDefinition } from '@context-towel/card-library'
import type { TaskData, TaskStatus, TaskPriority } from '@context-towel/card-library'

// Other plugins: checklist, diagram, toc, note, rule, question, form,
// command-result, file-content, file-diff, file-list
// All follow the same pattern: register*Block, *Card, *BlockDefinition
```
