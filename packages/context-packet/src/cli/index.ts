#!/usr/bin/env node

// ============================================================================
// packet CLI — Entry point for the context-packet command line interface
// ============================================================================

import { resolve } from 'node:path'
import { readFile, writeFile, mkdir, readdir, rm, access } from 'node:fs/promises'
import { MikroORM } from '@mikro-orm/sqlite'
import { MikroOrmPacketDatabase } from '../storage/MikroOrmPacketDatabase.js'
import { packetEntities } from '../storage/entities.js'
import { PacketEngine } from '../PacketEngine.js'
import type { FileService } from '../types.js'
import { runCommand } from './commands.js'
import { runContextCommand } from './context.js'
import { runInitCommand } from './init.js'

// ── Node.js FileService implementation ────────────────────────────────────

const nodeFs: FileService = {
  async read(path: string): Promise<string> {
    return readFile(path, 'utf-8')
  },

  async write(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8')
  },

  async exists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  },

  async mkdir(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true })
  },

  async list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      path: resolve(dirPath, entry.name),
      is_dir: entry.isDirectory(),
    }))
  },

  async remove(filePath: string): Promise<void> {
    await rm(filePath, { force: true })
  },
}

// ── MikroORM initialization ──────────────────────────────────────────────

async function initOrm(dbPath: string): Promise<MikroORM> {
  // Ensure directory exists
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'))
  await mkdir(dir, { recursive: true })

  return MikroORM.init({
    entities: packetEntities,
    dbName: dbPath,
    allowGlobalContext: true,
  })
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const contextDir = resolve(process.cwd(), '.context')
  const [,, command, ...rest] = process.argv

  // ── Fast paths (no DB initialization) ─────────────────────
  if (command === 'context') {
    return runContextCommand(contextDir)
  }

  if (command === 'init') {
    return runInitCommand(process.cwd(), rest)
  }

  // ── Standard path (needs DB) ──────────────────────────────
  const dbPath = resolve(contextDir, 'db', 'context.db')
  const orm = await initOrm(dbPath)

  try {
    // Ensure schema is up to date
    const generator = orm.getSchemaGenerator()
    await generator.updateSchema()

    const db = new MikroOrmPacketDatabase(orm.em)
    const engine = new PacketEngine(db, contextDir, nodeFs)
    const args = [command, ...rest].filter(Boolean)
    await runCommand(engine, db, args)
  } finally {
    await orm.close()
  }
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
