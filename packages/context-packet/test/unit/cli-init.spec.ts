import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runInitCommand } from '../../src/cli/init'
import { mkdtemp, rm, readFile, access, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ============================================================================
// Init Command Tests — Uses real filesystem in temp directories
// ============================================================================

describe('packet init', () => {
  let projectDir: string
  let logs: string[]
  let originalLog: typeof console.log

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'packet-init-'))
    logs = []
    originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    }
  })

  afterEach(async () => {
    console.log = originalLog
    await rm(projectDir, { recursive: true, force: true })
  })

  async function fileExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  it('creates .context directory structure', async () => {
    await runInitCommand(projectDir, [])

    expect(await fileExists(join(projectDir, '.context', 'db'))).toBe(true)
    expect(await fileExists(join(projectDir, '.context', 'packets', 'active'))).toBe(true)
    expect(await fileExists(join(projectDir, '.context', 'packets', 'archive'))).toBe(true)
  })

  it('creates .claude/bin/packet wrapper', async () => {
    await runInitCommand(projectDir, [])

    const wrapperPath = join(projectDir, '.claude', 'bin', 'packet')
    expect(await fileExists(wrapperPath)).toBe(true)

    const content = await readFile(wrapperPath, 'utf-8')
    expect(content).toContain('#!/bin/bash')
    expect(content).toContain('exec node')
    expect(content).toContain('index.js')

    // Check it's executable
    const stats = await stat(wrapperPath)
    expect(stats.mode & 0o111).toBeGreaterThan(0) // has execute bits
  })

  it('creates .claude/commands/ directory', async () => {
    await runInitCommand(projectDir, [])

    expect(await fileExists(join(projectDir, '.claude', 'commands'))).toBe(true)
  })

  it('configures hooks in .claude/settings.json', async () => {
    await runInitCommand(projectDir, [])

    const settingsPath = join(projectDir, '.claude', 'settings.json')
    const settings = JSON.parse(await readFile(settingsPath, 'utf-8'))

    expect(settings.hooks).toBeDefined()
    expect(settings.hooks.UserPromptSubmit).toBeDefined()
    expect(settings.hooks.Stop).toBeDefined()

    // Check UserPromptSubmit hook
    const promptHook = settings.hooks.UserPromptSubmit[0]
    expect(promptHook.matcher).toBe('')
    expect(promptHook.hooks[0].command).toContain('packet context')

    // Check Stop hook
    const stopHook = settings.hooks.Stop[0]
    expect(stopHook.hooks[0].command).toContain('packet snapshot')
  })

  it('adds permissions to .claude/settings.local.json', async () => {
    await runInitCommand(projectDir, [])

    const localPath = join(projectDir, '.claude', 'settings.local.json')
    const settings = JSON.parse(await readFile(localPath, 'utf-8'))

    expect(settings.permissions).toBeDefined()
    expect(settings.permissions.allow).toContain('Bash(packet:*)')
  })

  it('injects managed section into CLAUDE.md', async () => {
    await runInitCommand(projectDir, [])

    const claudeMd = await readFile(join(projectDir, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('<!-- CONTEXT_PACKET_INSTRUCTIONS_START -->')
    expect(claudeMd).toContain('<!-- CONTEXT_PACKET_INSTRUCTIONS_END -->')
    expect(claudeMd).toContain('Context Packet System')
    expect(claudeMd).toContain('/packet-new')
  })

  it('preserves existing CLAUDE.md content', async () => {
    const existingContent = '# My Project\n\nSome existing docs.\n'
    await import('node:fs/promises').then(fs =>
      fs.writeFile(join(projectDir, 'CLAUDE.md'), existingContent, 'utf-8')
    )

    await runInitCommand(projectDir, [])

    const claudeMd = await readFile(join(projectDir, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('# My Project')
    expect(claudeMd).toContain('Some existing docs.')
    expect(claudeMd).toContain('Context Packet System')
  })

  it('is idempotent — running twice produces same result', async () => {
    await runInitCommand(projectDir, [])
    const firstSettings = await readFile(join(projectDir, '.claude', 'settings.json'), 'utf-8')
    const firstClaudeMd = await readFile(join(projectDir, 'CLAUDE.md'), 'utf-8')

    // Reset logs
    logs = []

    await runInitCommand(projectDir, [])
    const secondSettings = await readFile(join(projectDir, '.claude', 'settings.json'), 'utf-8')
    const secondClaudeMd = await readFile(join(projectDir, 'CLAUDE.md'), 'utf-8')

    // Settings should be identical (no duplicate hooks)
    expect(secondSettings).toBe(firstSettings)
    // CLAUDE.md managed section should be replaced, not duplicated
    expect(secondClaudeMd).toBe(firstClaudeMd)
  })

  it('does not duplicate hooks on repeated runs', async () => {
    await runInitCommand(projectDir, [])
    await runInitCommand(projectDir, [])

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude', 'settings.json'), 'utf-8')
    )

    // Should have exactly one matcher per event, not two
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1)
    expect(settings.hooks.Stop).toHaveLength(1)
  })

  it('does not duplicate permissions on repeated runs', async () => {
    await runInitCommand(projectDir, [])
    await runInitCommand(projectDir, [])

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude', 'settings.local.json'), 'utf-8')
    )

    const packetPerms = (settings.permissions.allow as string[]).filter(
      (p: string) => p === 'Bash(packet:*)'
    )
    expect(packetPerms).toHaveLength(1)
  })

  it('merges into existing settings without clobbering', async () => {
    // Pre-create settings with existing hooks
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'echo existing' }],
          },
        ],
      },
      customSetting: true,
    }
    await import('node:fs/promises').then(async (fs) => {
      await fs.mkdir(join(projectDir, '.claude'), { recursive: true })
      await fs.writeFile(
        join(projectDir, '.claude', 'settings.json'),
        JSON.stringify(existingSettings),
        'utf-8'
      )
    })

    await runInitCommand(projectDir, [])

    const settings = JSON.parse(
      await readFile(join(projectDir, '.claude', 'settings.json'), 'utf-8')
    )

    // Custom setting preserved
    expect(settings.customSetting).toBe(true)
    // Existing hook preserved
    expect(settings.hooks.UserPromptSubmit).toHaveLength(2) // existing + packet
    // New hooks added
    expect(settings.hooks.Stop).toHaveLength(1)
  })

  it('--update flag works', async () => {
    await runInitCommand(projectDir, [])
    logs = []
    await runInitCommand(projectDir, ['--update'])

    const output = logs.join('\n')
    expect(output).toContain('re-synced')
  })

  it('outputs setup progress messages', async () => {
    await runInitCommand(projectDir, [])

    const output = logs.join('\n')
    expect(output).toContain('.context/')
    expect(output).toContain('.claude/bin/packet')
    expect(output).toContain('slash commands')
    expect(output).toContain('hooks')
    expect(output).toContain('CLAUDE.md')
    expect(output).toContain('Ready!')
  })
})
