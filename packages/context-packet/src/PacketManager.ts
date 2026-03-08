// ============================================================================
// PacketManager — Markdown file lifecycle for context packets
// ============================================================================

import type { FileService, PacketMetadata, CreatePacketOptions, ProblemVector, SnapshotEntry, SnapshotOptions } from './types'
import { FilePacketStore } from './storage/FilePacketStore'
import { generatePacketTemplate } from './template'
import { extractProblemVector, formatProblemVectorSummary, injectPacketIntoContent, removePacketSection } from './injection'
import { generateWorkflowSection } from './instructions'
import type { TaskSyncData, TaskSyncResult } from './task-sync'
import { extractTaskBlocks, buildTaskSourceMap, syncTaskToSourceFile } from './task-sync'

export class PacketManager {
  private store: FilePacketStore
  /** Tracks last snapshot time per packet name for debouncing */
  private lastSnapshotTime = new Map<string, number>()
  private snapshotDebounceMs: number

  constructor(
    private basePath: string,
    private fs: FileService,
    snapshotOptions?: SnapshotOptions,
  ) {
    this.store = new FilePacketStore(basePath, fs)
    this.snapshotDebounceMs = (snapshotOptions?.debounceSeconds ?? 30) * 1000
  }

  // ── Create ──────────────────────────────────────────────────────

  /**
   * Create a new packet from template.
   * Optionally seed tasks from a plan file's content.
   */
  async create(name: string, options: CreatePacketOptions = {}): Promise<string> {
    await this.store.ensureDir()

    const content = generatePacketTemplate(name, options)
    await this.store.writePacket(name, content)

    // Register in state
    const state = await this.store.loadState()
    const now = new Date().toISOString()
    state.packets[name] = {
      name,
      createdAt: now,
      updatedAt: now,
      planFileRef: options.planFileRef,
    }
    state.activePacket = name
    await this.store.saveState(state)

    // Initial snapshot
    this.lastSnapshotTime.set(name, Date.now())
    await this.store.writeSnapshot(name, content, now)

    return this.store.packetPath(name)
  }

  /**
   * Create a packet from a plan file, seeding tasks with source tracking.
   * Extracts task blocks from the plan file and records taskId → filePath mapping.
   */
  async createFromPlanFile(name: string, planFilePath: string): Promise<string> {
    // Read plan file and extract task blocks
    const planContent = await this.fs.read(planFilePath)
    const tasks = extractTaskBlocks(planContent, planFilePath)

    // Collect raw task blocks to seed into the packet
    const seedTasks = tasks
      .map(({ block }) => block.source.raw)
      .filter(Boolean)
      .join('\n\n')

    // Build task source map
    const taskSources = buildTaskSourceMap(planContent, planFilePath)

    // Create the packet with seeded tasks
    const path = await this.create(name, {
      planFileRef: planFilePath,
      seedTasks: seedTasks || undefined,
    })

    // Store task sources in state
    if (Object.keys(taskSources).length > 0) {
      const state = await this.store.loadState()
      if (state.packets[name]) {
        state.packets[name].taskSources = taskSources
        await this.store.saveState(state)
      }
    }

    return path
  }

  /**
   * Register additional task source mappings for a packet.
   * Use when adding tasks from files other than the original plan file.
   */
  async addTaskSources(packetName: string, sources: Record<string, string>): Promise<void> {
    const state = await this.store.loadState()
    const metadata = state.packets[packetName]
    if (!metadata) throw new Error(`Packet "${packetName}" not found`)

    metadata.taskSources = { ...metadata.taskSources, ...sources }
    await this.store.saveState(state)
  }

  /**
   * Get the source file path for a task in a packet.
   */
  async getTaskSource(packetName: string, taskId: string): Promise<string | null> {
    const state = await this.store.loadState()
    return state.packets[packetName]?.taskSources?.[taskId] ?? null
  }

  /**
   * Sync a task update back to its source file.
   * Re-reads the source file, finds the task by ID, replaces with updated data.
   */
  async syncTaskToSource(
    packetName: string,
    taskId: string,
    updatedTask: TaskSyncData,
  ): Promise<TaskSyncResult> {
    const sourceFile = await this.getTaskSource(packetName, taskId)
    if (!sourceFile) {
      return { success: false, error: `No source file tracked for task "${taskId}" in packet "${packetName}"` }
    }

    return syncTaskToSourceFile(this.fs, sourceFile, taskId, updatedTask)
  }

  // ── Read / Write ────────────────────────────────────────────────

  async load(name: string): Promise<string | null> {
    return this.store.readPacket(name)
  }

  async save(name: string, content: string): Promise<void> {
    await this.store.writePacket(name, content)

    // Update timestamp in state
    const state = await this.store.loadState()
    const now = new Date().toISOString()
    if (state.packets[name]) {
      state.packets[name].updatedAt = now
      await this.store.saveState(state)
    }

    // Snapshot with debounce
    await this.maybeSnapshot(name, content, now)
  }

  /**
   * Write a snapshot if enough time has elapsed since the last one.
   */
  private async maybeSnapshot(name: string, content: string, isoTimestamp: string): Promise<void> {
    const nowMs = Date.now()
    const lastMs = this.lastSnapshotTime.get(name) ?? 0

    if (nowMs - lastMs < this.snapshotDebounceMs) return

    this.lastSnapshotTime.set(name, nowMs)
    await this.store.writeSnapshot(name, content, isoTimestamp)
  }

  async list(): Promise<PacketMetadata[]> {
    const state = await this.store.loadState()
    return Object.values(state.packets)
  }

  async delete(name: string): Promise<void> {
    await this.store.deletePacket(name)

    const state = await this.store.loadState()
    delete state.packets[name]
    if (state.activePacket === name) {
      state.activePacket = null
    }
    await this.store.saveState(state)
  }

  // ── Active packet ───────────────────────────────────────────────

  async getActive(): Promise<string | null> {
    const state = await this.store.loadState()
    return state.activePacket
  }

  async setActive(name: string | null): Promise<void> {
    const state = await this.store.loadState()
    if (name !== null && !state.packets[name]) {
      throw new Error(`Packet "${name}" not found`)
    }
    state.activePacket = name
    await this.store.saveState(state)
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Append a timestamped entry to the Session Log section.
   */
  async appendLog(name: string, entry: string): Promise<void> {
    const content = await this.store.readPacket(name)
    if (!content) throw new Error(`Packet "${name}" not found`)

    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const logEntry = `- [${now}] ${entry}`

    // Find Session Log section and append before the next section
    const updated = appendToSection(content, 'Session Log', logEntry)
    await this.save(name, updated)
  }

  /**
   * Add a session reference to the Linked section.
   */
  async addSessionRef(name: string, sessionPath: string): Promise<void> {
    const content = await this.store.readPacket(name)
    if (!content) throw new Error(`Packet "${name}" not found`)

    const ref = `- Session: \`${sessionPath}\``
    const updated = appendToSection(content, 'Linked', ref)
    await this.save(name, updated)
  }

  // ── CLAUDE.md integration ───────────────────────────────────────

  /**
   * Generate the content to inject into CLAUDE.md for the active packet.
   * Returns null if no active packet or problem vector is empty.
   */
  async getPacketContent(): Promise<string | null> {
    const state = await this.store.loadState()
    if (!state.activePacket) return null

    const content = await this.store.readPacket(state.activePacket)
    if (!content) return null

    const vector = extractProblemVector(content)
    if (!vector) return null

    const packetPath = this.store.packetPath(state.activePacket)
    const summary = formatProblemVectorSummary(state.activePacket, vector, packetPath)
    const workflow = generateWorkflowSection()

    return summary + '\n\n' + workflow
  }

  /**
   * Inject the active packet's content into a CLAUDE.md file string.
   * If no active packet, removes any existing packet section.
   */
  async injectIntoClaudeMd(fileContent: string): Promise<string> {
    const packetContent = await this.getPacketContent()
    if (packetContent) {
      return injectPacketIntoContent(fileContent, packetContent)
    }
    return removePacketSection(fileContent)
  }

  // ── Archive ─────────────────────────────────────────────────────

  /**
   * Archive a completed packet.
   * Strips session-specific content, moves to archive, updates pattern index.
   */
  async archive(name: string): Promise<void> {
    const content = await this.store.readPacket(name)
    if (!content) throw new Error(`Packet "${name}" not found`)

    // Strip session-specific sections
    const stripped = stripSessionContent(content)
    const state = await this.store.loadState()
    const metadata = state.packets[name]

    // Write stripped version to archive
    await this.store.moveToArchive(name)
    // Overwrite archive with stripped version
    const archiveDir = `${this.basePath}/archive`
    if (!(await this.fs.exists(archiveDir))) {
      await this.fs.mkdir(archiveDir)
    }
    await this.fs.write(`${archiveDir}/${name}.md`, stripped)

    // Update pattern index
    const vector = extractProblemVector(content)
    const patterns = extractPatterns(content)
    await this.updatePatternIndex(name, vector, patterns, metadata?.tags)

    // Remove from active state
    delete state.packets[name]
    if (state.activePacket === name) {
      state.activePacket = null
    }
    await this.store.saveState(state)
  }

  async listArchived(): Promise<string[]> {
    return this.store.listArchived()
  }

  async readArchived(name: string): Promise<string | null> {
    return this.store.readArchived(name)
  }

  private async updatePatternIndex(
    name: string,
    vector: ProblemVector | null,
    patterns: string[],
    tags?: string[],
  ): Promise<void> {
    const indexPath = `${this.basePath}/archive/pattern-index.md`

    let index = ''
    if (await this.fs.exists(indexPath)) {
      index = await this.fs.read(indexPath)
    } else {
      index = '# Pattern Index\n\nArchived packets as reusable patterns.\n'
    }

    const lines: string[] = [
      '',
      `## ${name}`,
    ]

    if (vector) {
      lines.push(`**Problem:** ${vector.current} → ${vector.target}`)
    }
    if (patterns.length > 0) {
      lines.push(`**Patterns:** ${patterns.join(', ')}`)
    }
    if (tags && tags.length > 0) {
      lines.push(`**Tags:** ${tags.join(', ')}`)
    }
    lines.push(`**Source:** \`.context/packets/archive/${name}.md\``)

    index += lines.join('\n') + '\n'
    await this.fs.write(indexPath, index)
  }

  // ── Version History ────────────────────────────────────────────

  /**
   * List all snapshots for a packet, sorted chronologically.
   */
  async getHistory(name: string): Promise<SnapshotEntry[]> {
    return this.store.listSnapshots(name)
  }

  /**
   * Load a specific snapshot by timestamp.
   */
  async loadSnapshot(name: string, timestamp: string): Promise<string | null> {
    return this.store.readSnapshot(name, timestamp)
  }

  // ── Packet path accessor ───────────────────────────────────────

  getPacketPath(name: string): string {
    return this.store.packetPath(name)
  }
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Append a line to a markdown section (before the next ## heading).
 */
function appendToSection(content: string, sectionName: string, line: string): string {
  const sectionPattern = new RegExp(`(## ${sectionName}\\s*\\n)([\\s\\S]*?)(?=\\n## |$)`)
  const match = content.match(sectionPattern)

  if (!match) {
    // Section doesn't exist — append at end
    return content + `\n## ${sectionName}\n${line}\n`
  }

  const sectionStart = match.index! + match[1].length
  const sectionContent = match[2]

  // Find last non-empty line in section to append after it
  const trimmed = sectionContent.replace(/\s+$/, '')
  const insertAt = sectionStart + trimmed.length

  return content.slice(0, insertAt) + '\n' + line + content.slice(insertAt)
}

/**
 * Strip session-specific content from a packet for archiving.
 * Removes: Session Log entries, Linked session refs.
 * Keeps: Problem Vector, Architecture, Data Model, Patterns Applied, Active Tasks, Tried & Pivoted.
 */
function stripSessionContent(content: string): string {
  let result = content

  // Clear Session Log section content but keep the heading
  result = result.replace(
    /(## Session Log\s*\n)([\s\S]*?)(?=\n## |$)/,
    '$1*Archived — see session transcripts for history.*\n',
  )

  // Remove session refs from Linked section (keep plan/doc refs)
  result = result.replace(
    /- Session: `[^`]+`\n?/g,
    '',
  )

  return result
}

/**
 * Extract pattern names from the Patterns Applied section.
 */
function extractPatterns(content: string): string[] {
  const sectionMatch = content.match(
    /## Patterns Applied\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const patterns: string[] = []
  const patternRegex = /\*\*([^*]+)\*\*/g
  let match: RegExpExecArray | null
  while ((match = patternRegex.exec(sectionMatch[1])) !== null) {
    patterns.push(match[1])
  }
  return patterns
}
