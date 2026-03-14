import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { SqljsPacketDatabase } from '../../../src/storage/SqljsPacketDatabase'
import { runStorageConformanceTests } from './in-memory.spec'

// ============================================================================
// Run conformance tests with SqljsPacketDatabase
// ============================================================================

// Pre-initialize sql.js WASM module so we can create databases synchronously
let SQL: SqlJsStatic

beforeAll(async () => {
  SQL = await initSqlJs()
})

describe('SqljsPacketDatabase', () => {
  // Use createSync with pre-initialized SQL module so the factory is synchronous,
  // matching the conformance test runner's expected signature.
  runStorageConformanceTests(() => SqljsPacketDatabase.createSync(SQL))
})

// ============================================================================
// SQL.js-specific tests (export/import round-trip, persistence)
// ============================================================================

describe('SqljsPacketDatabase (sql.js specific)', () => {
  describe('export/import round-trip', () => {
    it('preserves data across export and reimport', async () => {
      const db1 = SqljsPacketDatabase.createSync(SQL)

      // Write data across all tables
      await db1.setPacketMeta('test-packet', { planFileRef: 'plan.md', tags: ['a', 'b'] })
      await db1.setActivePacket('test-packet')
      await db1.writeVersion('test-packet', 'delta', 'v1 content', 'diff1')
      await db1.appendDelta('test-packet', { type: 'discovery', content: 'found it', nodeId: 'n1' })
      await db1.writeKeyframe('test-packet', 'n1', 'kf content')
      await db1.writePattern({ subsystem: 'auth', content: 'jwt pattern', sourcePacket: 'test-packet' })

      // Export and close
      const data = db1.export()
      db1.close()

      // Reimport from exported data
      const db2 = SqljsPacketDatabase.openSync(SQL, data)

      // Verify packet meta preserved
      const meta = await db2.getPacketMeta('test-packet')
      expect(meta).not.toBeNull()
      expect(meta!.name).toBe('test-packet')
      expect(meta!.planFileRef).toBe('plan.md')
      expect(meta!.tags).toEqual(['a', 'b'])

      // Verify active packet preserved
      expect(await db2.getActivePacket()).toBe('test-packet')

      // Verify versions preserved
      const versions = await db2.getVersions('test-packet')
      expect(versions).toHaveLength(1)
      expect(versions[0].content).toBe('v1 content')
      expect(versions[0].deltaFromPrev).toBe('diff1')

      // Verify deltas preserved
      const deltas = await db2.getDeltas('test-packet')
      expect(deltas).toHaveLength(1)
      expect(deltas[0].content).toBe('found it')
      expect(deltas[0].nodeId).toBe('n1')

      // Verify keyframes preserved
      const keyframes = await db2.getKeyframes('test-packet')
      expect(keyframes).toHaveLength(1)
      expect(keyframes[0].content).toBe('kf content')

      // Verify patterns preserved
      const patterns = await db2.getAllPatterns()
      expect(patterns).toHaveLength(1)
      expect(patterns[0].content).toBe('jwt pattern')

      db2.close()
    })

    it('handles empty database export/import', () => {
      const db1 = SqljsPacketDatabase.createSync(SQL)
      const data = db1.export()
      db1.close()

      const db2 = SqljsPacketDatabase.openSync(SQL, data)
      expect(db2.export()).toBeInstanceOf(Uint8Array)
      db2.close()
    })
  })

  describe('close and reopen', () => {
    it('data persists through export/close/open cycle', async () => {
      const db1 = SqljsPacketDatabase.createSync(SQL)

      await db1.setPacketMeta('persist-test', { tags: ['persistent'] })
      await db1.writeVersion('persist-test', 'delta', 'persisted content')

      const exported = db1.export()
      db1.close()

      // Simulate reopening from saved data
      const db2 = SqljsPacketDatabase.openSync(SQL, exported)

      const meta = await db2.getPacketMeta('persist-test')
      expect(meta).not.toBeNull()
      expect(meta!.tags).toEqual(['persistent'])

      const versions = await db2.getVersions('persist-test')
      expect(versions).toHaveLength(1)
      expect(versions[0].content).toBe('persisted content')

      db2.close()
    })
  })
})
