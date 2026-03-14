// ============================================================================
// SqljsPacketDatabase — SQLite (via sql.js/WASM) implementation of PacketDatabase
// ============================================================================

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type {
  PacketVersion,
  DeltaEntry,
  KeyframeEntry,
  PatternEntry,
  PacketMeta,
  VersionTrigger,
} from '../types.js'
import type { PacketDatabase } from './PacketDatabase.js'

const SCHEMA = `
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
`

export class SqljsPacketDatabase implements PacketDatabase {
  private db: Database

  private constructor(db: Database) {
    this.db = db
    this.initSchema()
  }

  /** Create a new in-memory database. */
  static async create(): Promise<SqljsPacketDatabase> {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    return new SqljsPacketDatabase(db)
  }

  /** Create a new in-memory database from a pre-initialized sql.js module. */
  static createSync(SQL: SqlJsStatic): SqljsPacketDatabase {
    const db = new SQL.Database()
    return new SqljsPacketDatabase(db)
  }

  /** Open a database from existing data (e.g. loaded from disk). */
  static async open(data: Uint8Array): Promise<SqljsPacketDatabase> {
    const SQL = await initSqlJs()
    const db = new SQL.Database(data)
    return new SqljsPacketDatabase(db)
  }

  /** Open a database from existing data using a pre-initialized sql.js module. */
  static openSync(SQL: SqlJsStatic, data: Uint8Array): SqljsPacketDatabase {
    const db = new SQL.Database(data)
    return new SqljsPacketDatabase(db)
  }

  /** Export database as Uint8Array for saving to disk. */
  export(): Uint8Array {
    return this.db.export()
  }

  /** Close the database. */
  close(): void {
    this.db.close()
  }

  private initSchema(): void {
    this.db.run(SCHEMA)
  }

  // ── Version snapshots ──────────────────────────────────────────────────

  async writeVersion(
    packetName: string,
    trigger: VersionTrigger,
    content: string,
    delta?: string,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const timestamp = Date.now()

    this.db.run(
      'INSERT INTO versions (id, packet_name, timestamp, trigger_type, content, delta_from_prev) VALUES (?, ?, ?, ?, ?, ?)',
      [id, packetName, timestamp, trigger, content, delta ?? null],
    )

    return id
  }

  async getVersions(packetName: string, limit?: number): Promise<PacketVersion[]> {
    const sql = limit !== undefined && limit > 0
      ? 'SELECT * FROM versions WHERE packet_name = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?'
      : 'SELECT * FROM versions WHERE packet_name = ? ORDER BY timestamp DESC, rowid DESC'

    const params = limit !== undefined && limit > 0
      ? [packetName, limit]
      : [packetName]

    const results = this.db.exec(sql, params)
    if (results.length === 0) return []

    return results[0].values.map(row => this.rowToVersion(row, results[0].columns))
  }

  async getVersion(id: string): Promise<PacketVersion | null> {
    const results = this.db.exec('SELECT * FROM versions WHERE id = ?', [id])
    if (results.length === 0 || results[0].values.length === 0) return null
    return this.rowToVersion(results[0].values[0], results[0].columns)
  }

  async getLatestVersion(packetName: string): Promise<PacketVersion | null> {
    const results = this.db.exec(
      'SELECT * FROM versions WHERE packet_name = ? ORDER BY timestamp DESC, rowid DESC LIMIT 1',
      [packetName],
    )
    if (results.length === 0 || results[0].values.length === 0) return null
    return this.rowToVersion(results[0].values[0], results[0].columns)
  }

  async deleteVersion(id: string): Promise<void> {
    this.db.run('DELETE FROM versions WHERE id = ?', [id])
  }

  async pruneVersions(packetName: string, keepCount: number): Promise<number> {
    // Get all versions newest-first
    const all = await this.getVersions(packetName)
    if (all.length <= keepCount) return 0

    const toDelete: string[] = []
    let kept = 0

    for (const v of all) {
      // all is already newest-first from getVersions
      if (kept < keepCount) {
        kept++
      } else if (v.trigger === 'keyframe' || v.trigger === 'collapse') {
        // Always keep keyframes and collapses
      } else {
        toDelete.push(v.id)
      }
    }

    for (const id of toDelete) {
      this.db.run('DELETE FROM versions WHERE id = ?', [id])
    }

    return toDelete.length
  }

  // ── Delta log ──────────────────────────────────────────────────────────

  async appendDelta(
    packetName: string,
    entry: Omit<DeltaEntry, 'id' | 'packetName' | 'timestamp'>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const timestamp = Date.now()

    this.db.run(
      'INSERT INTO deltas (id, packet_name, timestamp, node_id, type, content) VALUES (?, ?, ?, ?, ?, ?)',
      [id, packetName, timestamp, entry.nodeId ?? null, entry.type, entry.content],
    )

    return id
  }

  async getDeltas(packetName: string, since?: number): Promise<DeltaEntry[]> {
    if (since !== undefined) {
      const results = this.db.exec(
        'SELECT * FROM deltas WHERE packet_name = ? AND timestamp >= ? ORDER BY timestamp ASC, rowid ASC',
        [packetName, since],
      )
      if (results.length === 0) return []
      return results[0].values.map(row => this.rowToDelta(row, results[0].columns))
    }

    const results = this.db.exec(
      'SELECT * FROM deltas WHERE packet_name = ? ORDER BY timestamp ASC, rowid ASC',
      [packetName],
    )
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToDelta(row, results[0].columns))
  }

  async getDeltasForNode(packetName: string, nodeId: string): Promise<DeltaEntry[]> {
    const results = this.db.exec(
      'SELECT * FROM deltas WHERE packet_name = ? AND node_id = ? ORDER BY timestamp ASC, rowid ASC',
      [packetName, nodeId],
    )
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToDelta(row, results[0].columns))
  }

  async deleteDeltasBeforeForNode(
    packetName: string,
    nodeId: string,
    beforeTimestamp: number,
  ): Promise<number> {
    // Count first so we can return the number deleted
    const countResult = this.db.exec(
      'SELECT COUNT(*) FROM deltas WHERE packet_name = ? AND node_id = ? AND timestamp < ?',
      [packetName, nodeId, beforeTimestamp],
    )
    const count = countResult.length > 0 && countResult[0].values.length > 0
      ? countResult[0].values[0][0] as number
      : 0

    this.db.run(
      'DELETE FROM deltas WHERE packet_name = ? AND node_id = ? AND timestamp < ?',
      [packetName, nodeId, beforeTimestamp],
    )

    return count
  }

  // ── Keyframes ──────────────────────────────────────────────────────────

  async writeKeyframe(
    packetName: string,
    triggerNodeId: string,
    content: string,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const timestamp = Date.now()

    this.db.run(
      'INSERT INTO keyframes (id, packet_name, timestamp, trigger_node_id, content) VALUES (?, ?, ?, ?, ?)',
      [id, packetName, timestamp, triggerNodeId, content],
    )

    return id
  }

  async getKeyframes(packetName: string): Promise<KeyframeEntry[]> {
    const results = this.db.exec(
      'SELECT * FROM keyframes WHERE packet_name = ? ORDER BY timestamp ASC, rowid ASC',
      [packetName],
    )
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToKeyframe(row, results[0].columns))
  }

  async getLatestKeyframe(packetName: string): Promise<KeyframeEntry | null> {
    const results = this.db.exec(
      'SELECT * FROM keyframes WHERE packet_name = ? ORDER BY timestamp DESC, rowid DESC LIMIT 1',
      [packetName],
    )
    if (results.length === 0 || results[0].values.length === 0) return null
    return this.rowToKeyframe(results[0].values[0], results[0].columns)
  }

  // ── Patterns ───────────────────────────────────────────────────────────

  async writePattern(
    pattern: Omit<PatternEntry, 'id' | 'createdAt' | 'updatedAt' | 'confidence'>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = Date.now()

    this.db.run(
      'INSERT INTO patterns (id, subsystem, codebase, content, source_packet, created_at, updated_at, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, pattern.subsystem, pattern.codebase ?? null, pattern.content, pattern.sourcePacket, now, now, 1],
    )

    return id
  }

  async findPatterns(subsystem: string, codebase?: string): Promise<PatternEntry[]> {
    if (codebase !== undefined) {
      const results = this.db.exec(
        'SELECT * FROM patterns WHERE subsystem = ? AND codebase = ?',
        [subsystem, codebase],
      )
      if (results.length === 0) return []
      return results[0].values.map(row => this.rowToPattern(row, results[0].columns))
    }

    const results = this.db.exec(
      'SELECT * FROM patterns WHERE subsystem = ?',
      [subsystem],
    )
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToPattern(row, results[0].columns))
  }

  async getAllPatterns(): Promise<PatternEntry[]> {
    const results = this.db.exec('SELECT * FROM patterns')
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToPattern(row, results[0].columns))
  }

  async incrementConfidence(patternId: string): Promise<void> {
    // Check existence first
    const existing = this.db.exec('SELECT id FROM patterns WHERE id = ?', [patternId])
    if (existing.length === 0 || existing[0].values.length === 0) {
      throw new Error(`Pattern "${patternId}" not found`)
    }

    this.db.run(
      'UPDATE patterns SET confidence = confidence + 1, updated_at = ? WHERE id = ?',
      [Date.now(), patternId],
    )
  }

  // ── Packet metadata ────────────────────────────────────────────────────

  async getPacketMeta(name: string): Promise<PacketMeta | null> {
    const results = this.db.exec('SELECT * FROM packet_meta WHERE name = ?', [name])
    if (results.length === 0 || results[0].values.length === 0) return null
    return this.rowToPacketMeta(results[0].values[0], results[0].columns)
  }

  async setPacketMeta(name: string, meta: Partial<PacketMeta>): Promise<void> {
    const existing = await this.getPacketMeta(name)
    const now = Date.now()

    if (existing) {
      // Update existing -- preserve createdAt, update updatedAt
      const tags = meta.tags !== undefined ? JSON.stringify(meta.tags) : JSON.stringify(existing.tags ?? [])
      const planFileRef = meta.planFileRef !== undefined ? meta.planFileRef : existing.planFileRef

      this.db.run(
        'UPDATE packet_meta SET updated_at = ?, plan_file_ref = ?, tags = ? WHERE name = ?',
        [now, planFileRef ?? null, tags, name],
      )
    } else {
      // Insert new
      const tags = JSON.stringify(meta.tags ?? [])
      const createdAt = meta.createdAt ?? now
      const updatedAt = meta.updatedAt ?? now

      this.db.run(
        'INSERT INTO packet_meta (name, created_at, updated_at, active_packet, plan_file_ref, tags) VALUES (?, ?, ?, ?, ?, ?)',
        [name, createdAt, updatedAt, 0, meta.planFileRef ?? null, tags],
      )
    }
  }

  async listPackets(): Promise<PacketMeta[]> {
    const results = this.db.exec('SELECT * FROM packet_meta')
    if (results.length === 0) return []
    return results[0].values.map(row => this.rowToPacketMeta(row, results[0].columns))
  }

  async deletePacket(name: string): Promise<void> {
    // Check if this is the active packet
    const meta = await this.getPacketMeta(name)
    const wasActive = meta ? await this.isActivePacket(name) : false

    // Delete associated data
    this.db.run('DELETE FROM versions WHERE packet_name = ?', [name])
    this.db.run('DELETE FROM deltas WHERE packet_name = ?', [name])
    this.db.run('DELETE FROM keyframes WHERE packet_name = ?', [name])
    this.db.run('DELETE FROM packet_meta WHERE name = ?', [name])

    // Clear active if this was the active packet
    if (wasActive) {
      // No active packet anymore -- nothing to update since the row is gone
    }
  }

  async getActivePacket(): Promise<string | null> {
    const results = this.db.exec('SELECT name FROM packet_meta WHERE active_packet = 1 LIMIT 1')
    if (results.length === 0 || results[0].values.length === 0) return null
    return results[0].values[0][0] as string
  }

  async setActivePacket(name: string | null): Promise<void> {
    if (name !== null) {
      // Verify the packet exists
      const existing = await this.getPacketMeta(name)
      if (!existing) {
        throw new Error(`Packet "${name}" not found`)
      }
    }

    // Clear all active flags
    this.db.run('UPDATE packet_meta SET active_packet = 0')

    // Set the new active packet
    if (name !== null) {
      this.db.run('UPDATE packet_meta SET active_packet = 1 WHERE name = ?', [name])
    }
  }

  // ── Row mapping helpers ────────────────────────────────────────────────

  private colIndex(columns: string[], name: string): number {
    const idx = columns.indexOf(name)
    if (idx === -1) {
      throw new Error(`Column "${name}" not found in result set. Available: ${columns.join(', ')}`)
    }
    return idx
  }

  private rowToVersion(row: unknown[], columns: string[]): PacketVersion {
    return {
      id: row[this.colIndex(columns, 'id')] as string,
      packetName: row[this.colIndex(columns, 'packet_name')] as string,
      timestamp: row[this.colIndex(columns, 'timestamp')] as number,
      trigger: row[this.colIndex(columns, 'trigger_type')] as VersionTrigger,
      content: row[this.colIndex(columns, 'content')] as string,
      deltaFromPrev: (row[this.colIndex(columns, 'delta_from_prev')] as string | null) ?? undefined,
    }
  }

  private rowToDelta(row: unknown[], columns: string[]): DeltaEntry {
    return {
      id: row[this.colIndex(columns, 'id')] as string,
      packetName: row[this.colIndex(columns, 'packet_name')] as string,
      timestamp: row[this.colIndex(columns, 'timestamp')] as number,
      nodeId: (row[this.colIndex(columns, 'node_id')] as string | null) ?? undefined,
      type: row[this.colIndex(columns, 'type')] as DeltaEntry['type'],
      content: row[this.colIndex(columns, 'content')] as string,
    }
  }

  private rowToKeyframe(row: unknown[], columns: string[]): KeyframeEntry {
    return {
      id: row[this.colIndex(columns, 'id')] as string,
      packetName: row[this.colIndex(columns, 'packet_name')] as string,
      timestamp: row[this.colIndex(columns, 'timestamp')] as number,
      triggerNodeId: row[this.colIndex(columns, 'trigger_node_id')] as string,
      content: row[this.colIndex(columns, 'content')] as string,
    }
  }

  private rowToPattern(row: unknown[], columns: string[]): PatternEntry {
    return {
      id: row[this.colIndex(columns, 'id')] as string,
      subsystem: row[this.colIndex(columns, 'subsystem')] as string,
      codebase: (row[this.colIndex(columns, 'codebase')] as string | null) ?? undefined,
      content: row[this.colIndex(columns, 'content')] as string,
      sourcePacket: row[this.colIndex(columns, 'source_packet')] as string,
      createdAt: row[this.colIndex(columns, 'created_at')] as number,
      updatedAt: row[this.colIndex(columns, 'updated_at')] as number,
      confidence: row[this.colIndex(columns, 'confidence')] as number,
    }
  }

  private rowToPacketMeta(row: unknown[], columns: string[]): PacketMeta {
    const tagsRaw = row[this.colIndex(columns, 'tags')] as string
    let tags: string[] | undefined
    try {
      const parsed = JSON.parse(tagsRaw)
      tags = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined
    } catch {
      tags = undefined
    }

    const planFileRef = (row[this.colIndex(columns, 'plan_file_ref')] as string | null) ?? undefined

    return {
      name: row[this.colIndex(columns, 'name')] as string,
      createdAt: row[this.colIndex(columns, 'created_at')] as number,
      updatedAt: row[this.colIndex(columns, 'updated_at')] as number,
      planFileRef,
      tags,
    }
  }

  private async isActivePacket(name: string): Promise<boolean> {
    const results = this.db.exec(
      'SELECT active_packet FROM packet_meta WHERE name = ?',
      [name],
    )
    if (results.length === 0 || results[0].values.length === 0) return false
    return results[0].values[0][0] === 1
  }
}
