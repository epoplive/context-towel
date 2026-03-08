import { describe, it, expect, beforeEach } from 'vitest'
import { FilePacketStore } from '../../src/storage/FilePacketStore'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

describe('FilePacketStore', () => {
  let fs: FileService
  let store: FilePacketStore

  beforeEach(() => {
    fs = createMockFs()
    store = new FilePacketStore('.context/packets', fs)
  })

  describe('read / write', () => {
    it('writes and reads a packet', async () => {
      await store.writePacket('test', '# Test Packet')
      const content = await store.readPacket('test')
      expect(content).toBe('# Test Packet')
    })

    it('returns null for non-existent packet', async () => {
      const content = await store.readPacket('nope')
      expect(content).toBeNull()
    })
  })

  describe('list', () => {
    it('lists packet names', async () => {
      await store.writePacket('one', '# One')
      await store.writePacket('two', '# Two')

      const names = await store.listPackets()
      expect(names).toContain('one')
      expect(names).toContain('two')
    })

    it('returns empty array when no packets', async () => {
      const names = await store.listPackets()
      expect(names).toEqual([])
    })
  })

  describe('delete', () => {
    it('deletes a packet', async () => {
      await store.writePacket('to-delete', '# Delete me')
      await store.deletePacket('to-delete')

      const content = await store.readPacket('to-delete')
      expect(content).toBeNull()
    })
  })

  describe('exists', () => {
    it('checks if a packet exists', async () => {
      expect(await store.packetExists('nope')).toBe(false)
      await store.writePacket('exists', '# I exist')
      expect(await store.packetExists('exists')).toBe(true)
    })
  })

  describe('state management', () => {
    it('loads default state when no state file', async () => {
      const state = await store.loadState()
      expect(state).toEqual({ activePacket: null, packets: {} })
    })

    it('saves and loads state', async () => {
      const state = {
        activePacket: 'test',
        packets: {
          test: {
            name: 'test',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      }
      await store.saveState(state)

      const loaded = await store.loadState()
      expect(loaded).toEqual(state)
    })
  })

  describe('history / snapshots', () => {
    it('writes and lists snapshots', async () => {
      const ts = '2026-03-01T08:00:00'
      await store.writeSnapshot('test', '# Snapshot 1', ts)

      const entries = await store.listSnapshots('test')
      expect(entries).toHaveLength(1)
      expect(entries[0].timestamp).toBe('2026-03-01T08:00:00')
    })

    it('reads a snapshot by timestamp', async () => {
      const ts = '2026-03-01T08:00:00'
      await store.writeSnapshot('test', '# Snapshot content', ts)

      const content = await store.readSnapshot('test', ts)
      expect(content).toBe('# Snapshot content')
    })

    it('returns null for non-existent snapshot', async () => {
      const content = await store.readSnapshot('test', '2026-01-01T00:00:00')
      expect(content).toBeNull()
    })

    it('lists snapshots sorted chronologically', async () => {
      await store.writeSnapshot('test', '# V1', '2026-03-01T08:00:00')
      await store.writeSnapshot('test', '# V2', '2026-03-01T09:00:00')
      await store.writeSnapshot('test', '# V3', '2026-03-01T08:30:00')

      const entries = await store.listSnapshots('test')
      expect(entries).toHaveLength(3)
      expect(entries[0].timestamp).toBe('2026-03-01T08:00:00')
      expect(entries[1].timestamp).toBe('2026-03-01T08:30:00')
      expect(entries[2].timestamp).toBe('2026-03-01T09:00:00')
    })

    it('returns empty array when no history dir', async () => {
      const entries = await store.listSnapshots('nonexistent')
      expect(entries).toEqual([])
    })
  })

  describe('archive', () => {
    it('moves a packet to archive', async () => {
      await store.writePacket('archived', '# Archived content')
      await store.moveToArchive('archived')

      // Should be gone from main
      expect(await store.packetExists('archived')).toBe(false)

      // Should exist in archive
      const archiveContent = await store.readArchived('archived')
      expect(archiveContent).toBe('# Archived content')
    })

    it('lists archived packets', async () => {
      await store.writePacket('a', '# A')
      await store.moveToArchive('a')

      const archived = await store.listArchived()
      expect(archived).toContain('a')
    })
  })
})
