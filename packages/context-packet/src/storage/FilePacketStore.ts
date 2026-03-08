// ============================================================================
// File-based packet storage — simple markdown file I/O
// ============================================================================

import type { FileService, PacketState, SnapshotEntry } from '../types'

const STATE_FILE = 'packet-state.json'

/**
 * File-based packet store for `.context/packets/`.
 *
 * Directory structure:
 *   .context/packets/
 *     packet-state.json    # active packet + metadata index
 *     auth-system.md       # packet markdown files
 *     api-refactor.md
 */
export class FilePacketStore {
  constructor(
    private basePath: string,
    private fs: FileService,
  ) {}

  async ensureDir(): Promise<void> {
    if (!(await this.fs.exists(this.basePath))) {
      await this.fs.mkdir(this.basePath)
    }
  }

  packetPath(name: string): string {
    return `${this.basePath}/${name}.md`
  }

  async readPacket(name: string): Promise<string | null> {
    const path = this.packetPath(name)
    if (!(await this.fs.exists(path))) return null
    return this.fs.read(path)
  }

  async writePacket(name: string, content: string): Promise<void> {
    await this.ensureDir()
    await this.fs.write(this.packetPath(name), content)
  }

  async deletePacket(name: string): Promise<void> {
    const path = this.packetPath(name)
    if (await this.fs.exists(path)) {
      await this.fs.remove(path)
    }
  }

  async listPackets(): Promise<string[]> {
    if (!(await this.fs.exists(this.basePath))) return []
    const entries = await this.fs.list(this.basePath)
    return entries
      .filter(e => !e.is_dir && e.name.endsWith('.md'))
      .map(e => e.name.replace(/\.md$/, ''))
  }

  async packetExists(name: string): Promise<boolean> {
    return this.fs.exists(this.packetPath(name))
  }

  // ── State management ──────────────────────────────────────────

  private statePath(): string {
    return `${this.basePath}/${STATE_FILE}`
  }

  async loadState(): Promise<PacketState> {
    const path = this.statePath()
    if (!(await this.fs.exists(path))) {
      return { activePacket: null, packets: {} }
    }
    const json = await this.fs.read(path)
    return JSON.parse(json)
  }

  async saveState(state: PacketState): Promise<void> {
    await this.ensureDir()
    await this.fs.write(this.statePath(), JSON.stringify(state, null, 2))
  }

  // ── Archive ────────────────────────────────────────────────────

  private archivePath(): string {
    return `${this.basePath}/archive`
  }

  async moveToArchive(name: string): Promise<void> {
    const content = await this.readPacket(name)
    if (!content) return

    const archiveDir = this.archivePath()
    if (!(await this.fs.exists(archiveDir))) {
      await this.fs.mkdir(archiveDir)
    }

    await this.fs.write(`${archiveDir}/${name}.md`, content)
    await this.deletePacket(name)
  }

  async listArchived(): Promise<string[]> {
    const archiveDir = this.archivePath()
    if (!(await this.fs.exists(archiveDir))) return []
    const entries = await this.fs.list(archiveDir)
    return entries
      .filter(e => !e.is_dir && e.name.endsWith('.md'))
      .map(e => e.name.replace(/\.md$/, ''))
  }

  async readArchived(name: string): Promise<string | null> {
    const path = `${this.archivePath()}/${name}.md`
    if (!(await this.fs.exists(path))) return null
    return this.fs.read(path)
  }

  // ── History / Snapshots ─────────────────────────────────────

  private historyDir(name: string): string {
    return `${this.basePath}/.history/${name}`
  }

  async writeSnapshot(name: string, content: string, timestamp: string): Promise<string> {
    const dir = this.historyDir(name)
    if (!(await this.fs.exists(dir))) {
      await this.fs.mkdir(dir)
    }
    // Sanitize timestamp for filesystem: replace colons
    const safeName = timestamp.replace(/:/g, '-')
    const snapshotPath = `${dir}/${safeName}.md`
    await this.fs.write(snapshotPath, content)
    return snapshotPath
  }

  async listSnapshots(name: string): Promise<SnapshotEntry[]> {
    const dir = this.historyDir(name)
    if (!(await this.fs.exists(dir))) return []

    const entries = await this.fs.list(dir)
    return entries
      .filter(e => !e.is_dir && e.name.endsWith('.md'))
      .map(e => {
        // Restore colons from hyphens in the timestamp portion
        // Format: 2026-03-01T08-00-00.md → 2026-03-01T08:00:00
        const raw = e.name.replace(/\.md$/, '')
        // Only restore colons in the time part (after T)
        const tIdx = raw.indexOf('T')
        const timestamp = tIdx >= 0
          ? raw.slice(0, tIdx + 1) + raw.slice(tIdx + 1).replace(/-/g, ':')
          : raw
        return { timestamp, path: e.path }
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  async readSnapshot(name: string, timestamp: string): Promise<string | null> {
    const safeName = timestamp.replace(/:/g, '-')
    const path = `${this.historyDir(name)}/${safeName}.md`
    if (!(await this.fs.exists(path))) return null
    return this.fs.read(path)
  }
}
