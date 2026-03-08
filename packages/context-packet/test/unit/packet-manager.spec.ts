import { describe, it, expect, beforeEach } from 'vitest'
import { PacketManager } from '../../src/PacketManager'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

describe('PacketManager', () => {
  let fs: FileService
  let manager: PacketManager

  beforeEach(() => {
    fs = createMockFs()
    manager = new PacketManager('.context/packets', fs)
  })

  describe('create', () => {
    it('creates a packet file with template', async () => {
      const path = await manager.create('auth-system')

      expect(path).toBe('.context/packets/auth-system.md')

      const content = await manager.load('auth-system')
      expect(content).toContain('# Packet: auth-system')
      expect(content).toContain('## Problem Vector')
      expect(content).toContain('## Architecture')
    })

    it('sets the new packet as active', async () => {
      await manager.create('auth-system')
      const active = await manager.getActive()
      expect(active).toBe('auth-system')
    })

    it('stores metadata in state', async () => {
      await manager.create('auth-system', { planFileRef: 'plan.md' })
      const packets = await manager.list()

      expect(packets).toHaveLength(1)
      expect(packets[0].name).toBe('auth-system')
      expect(packets[0].planFileRef).toBe('plan.md')
    })

    it('seeds tasks from plan file', async () => {
      const tasks = `~~~task
id: task-1
title: Do something
status: todo
~~~`
      await manager.create('seeded', { seedTasks: tasks })
      const content = await manager.load('seeded')

      expect(content).toContain('id: task-1')
      expect(content).toContain('title: Do something')
    })
  })

  describe('load / save', () => {
    it('returns null for non-existent packet', async () => {
      const content = await manager.load('nope')
      expect(content).toBeNull()
    })

    it('saves and loads content', async () => {
      await manager.create('test')
      await manager.save('test', '# Updated content')

      const content = await manager.load('test')
      expect(content).toBe('# Updated content')
    })
  })

  describe('list / delete', () => {
    it('lists all packets', async () => {
      await manager.create('one')
      await manager.create('two')

      const packets = await manager.list()
      expect(packets).toHaveLength(2)
    })

    it('deletes a packet and removes from state', async () => {
      await manager.create('to-delete')
      await manager.delete('to-delete')

      const content = await manager.load('to-delete')
      expect(content).toBeNull()

      const packets = await manager.list()
      expect(packets).toHaveLength(0)
    })

    it('clears active when deleting the active packet', async () => {
      await manager.create('active-one')
      await manager.delete('active-one')

      const active = await manager.getActive()
      expect(active).toBeNull()
    })
  })

  describe('active packet', () => {
    it('gets and sets active packet', async () => {
      await manager.create('first')
      await manager.create('second')

      await manager.setActive('first')
      expect(await manager.getActive()).toBe('first')

      await manager.setActive(null)
      expect(await manager.getActive()).toBeNull()
    })

    it('throws when setting active to non-existent packet', async () => {
      await expect(manager.setActive('nope')).rejects.toThrow('Packet "nope" not found')
    })
  })

  describe('appendLog', () => {
    it('appends a timestamped entry to Session Log', async () => {
      await manager.create('logged')
      await manager.appendLog('logged', 'Started work on middleware')

      const content = await manager.load('logged')
      expect(content).toContain('Started work on middleware')
      // Should have both the creation entry and the appended entry
      expect(content).toContain('Created packet')
    })

    it('throws for non-existent packet', async () => {
      await expect(manager.appendLog('nope', 'entry')).rejects.toThrow()
    })
  })

  describe('addSessionRef', () => {
    it('adds session reference to Linked section', async () => {
      await manager.create('with-sessions')
      await manager.addSessionRef('with-sessions', '~/.claude/sessions/abc123.jsonl')

      const content = await manager.load('with-sessions')
      expect(content).toContain('Session: `~/.claude/sessions/abc123.jsonl`')
    })
  })

  describe('getPacketContent (CLAUDE.md integration)', () => {
    it('returns null when no active packet', async () => {
      const content = await manager.getPacketContent()
      expect(content).toBeNull()
    })

    it('returns null when problem vector is empty', async () => {
      await manager.create('empty-vector')
      const content = await manager.getPacketContent()
      // Template has placeholder comments, so vector extraction returns null
      expect(content).toBeNull()
    })

    it('returns formatted content when problem vector is filled', async () => {
      await manager.create('auth-system')

      // Update with real problem vector
      const packet = await manager.load('auth-system')
      const updated = packet!.replace(
        '**Current:** <!-- describe current broken/missing state -->',
        '**Current:** No authentication',
      ).replace(
        '**Target:** <!-- describe desired working state -->',
        '**Target:** JWT + RBAC',
      ).replace(
        '**Approach:** <!-- high-level strategy, patterns, key decisions -->',
        '**Approach:** Repository pattern',
      )
      await manager.save('auth-system', updated)

      const content = await manager.getPacketContent()
      expect(content).toContain('## Active Packet: auth-system')
      expect(content).toContain('**Problem:** No authentication → JWT + RBAC')
      expect(content).toContain('## Packet Workflow')
    })
  })

  describe('injectIntoClaudeMd', () => {
    it('removes section when no active packet', async () => {
      const claudeMd = `# Project

<!-- CONTEXT_PACKET_START -->
Old content
<!-- CONTEXT_PACKET_END -->

Other`

      const result = await manager.injectIntoClaudeMd(claudeMd)
      expect(result).not.toContain('CONTEXT_PACKET')
      expect(result).toContain('Other')
    })
  })

  describe('version history', () => {
    it('creates an initial snapshot on packet creation', async () => {
      await manager.create('test')
      const history = await manager.getHistory('test')
      expect(history.length).toBeGreaterThanOrEqual(1)
    })

    it('creates a snapshot on save (first save)', async () => {
      const fastManager = new PacketManager('.context/packets', fs, { debounceSeconds: 0 })
      await fastManager.create('test')
      const initialHistory = await fastManager.getHistory('test')

      // Wait to ensure different ISO timestamp
      await new Promise(r => setTimeout(r, 5))
      await fastManager.save('test', '# Updated')

      const history = await fastManager.getHistory('test')
      expect(history.length).toBeGreaterThanOrEqual(initialHistory.length + 1)
    })

    it('debounces rapid saves', async () => {
      // Use a large debounce — rapid saves should collapse
      const slowManager = new PacketManager('.context/packets', fs, { debounceSeconds: 9999 })
      await slowManager.create('debounce-test')
      const initialCount = (await slowManager.getHistory('debounce-test')).length

      // These should all be debounced (within 9999s window)
      await slowManager.save('debounce-test', '# V2')
      await slowManager.save('debounce-test', '# V3')
      await slowManager.save('debounce-test', '# V4')

      const history = await slowManager.getHistory('debounce-test')
      // Should not have additional snapshots beyond the initial one
      expect(history.length).toBe(initialCount)
    })

    it('loads a specific snapshot', async () => {
      const fastManager = new PacketManager('.context/packets', fs, { debounceSeconds: 0 })
      await fastManager.create('snapshot-test')

      // Wait 1ms to ensure different ISO timestamps
      await new Promise(r => setTimeout(r, 5))
      await fastManager.save('snapshot-test', '# Version 2')

      const history = await fastManager.getHistory('snapshot-test')
      expect(history.length).toBeGreaterThanOrEqual(2)

      // Load the first snapshot (creation)
      const firstSnapshot = await fastManager.loadSnapshot('snapshot-test', history[0].timestamp)
      expect(firstSnapshot).toContain('# Packet: snapshot-test')

      // Load the second snapshot (updated content)
      const lastSnapshot = await fastManager.loadSnapshot('snapshot-test', history[history.length - 1].timestamp)
      expect(lastSnapshot).toBe('# Version 2')
    })
  })

  describe('archive', () => {
    it('moves packet to archive and strips session content', async () => {
      await manager.create('done', { planFileRef: 'plan.md' })

      // Add some content
      const content = await manager.load('done')
      const withVector = content!.replace(
        '**Current:** <!-- describe current broken/missing state -->',
        '**Current:** Was broken',
      ).replace(
        '**Target:** <!-- describe desired working state -->',
        '**Target:** Now fixed',
      ).replace(
        '**Approach:** <!-- high-level strategy, patterns, key decisions -->',
        '**Approach:** Fixed it',
      )
      await manager.save('done', withVector)
      await manager.addSessionRef('done', '~/.claude/sessions/s1.jsonl')

      await manager.archive('done')

      // Should be gone from active list
      const packets = await manager.list()
      expect(packets).toHaveLength(0)

      // Should be in archive
      const archived = await manager.listArchived()
      expect(archived).toContain('done')

      // Archived content should have session log stripped
      const archivedContent = await manager.readArchived('done')
      expect(archivedContent).toContain('## Problem Vector')
      expect(archivedContent).toContain('Archived — see session transcripts')
      expect(archivedContent).not.toContain('Session: `~/.claude/sessions/s1.jsonl`')

      // Pattern index should exist
      const indexExists = await fs.exists('.context/packets/archive/pattern-index.md')
      expect(indexExists).toBe(true)
    })

    it('throws for non-existent packet', async () => {
      await expect(manager.archive('nope')).rejects.toThrow()
    })
  })
})
