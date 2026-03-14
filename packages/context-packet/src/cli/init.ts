// ============================================================================
// packet init — One-command Claude Code setup
// ============================================================================

import { resolve, dirname } from 'node:path'
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from './commands.js'

// ── Constants ─────────────────────────────────────────────────────────────

const INSTRUCTIONS_START = '<!-- CONTEXT_PACKET_INSTRUCTIONS_START -->'
const INSTRUCTIONS_END = '<!-- CONTEXT_PACKET_INSTRUCTIONS_END -->'

const CLAUDE_MD_SECTION = `${INSTRUCTIONS_START}
## Context Packet System

This project uses the context packet system for structured problem-solving.
When a packet is active, compact state is injected at the start of each
prompt via hook. Read \`.context/packets/active/<name>.md\` for full packet state.

**Commands:** /packet, /packet-new, /packet-logic, /packet-review,
/packet-done, /packet-fail, /packet-archive

**Workflow:** Logic pass → review gate → implementation → packet update.
Never edit packet files directly — use the \`packet\` CLI.
${INSTRUCTIONS_END}`

const SLASH_COMMANDS = [
  'packet',
  'packet-new',
  'packet-logic',
  'packet-review',
  'packet-done',
  'packet-fail',
  'packet-archive',
]

// ── Helpers ───────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function resolvePackageSrcDir(): string {
  // In compiled output: dist/cli/init.js → need to find dist/commands/
  // In source: src/cli/init.ts → need to find src/commands/
  const thisFile = typeof __filename !== 'undefined'
    ? __filename
    : fileURLToPath(import.meta.url)
  // Go up from cli/ to package root's dist/ or src/, then into commands/
  return resolve(dirname(thisFile), '..', 'commands')
}

function resolveBinaryEntrypoint(): string {
  const thisFile = typeof __filename !== 'undefined'
    ? __filename
    : fileURLToPath(import.meta.url)
  // This file is at dist/cli/init.js — the CLI entry is dist/cli/index.js
  return resolve(dirname(thisFile), 'index.js')
}

// ── Settings merge ────────────────────────────────────────────────────────

interface HookEntry {
  type: string
  command: string
}

interface HookMatcher {
  matcher: string
  hooks: HookEntry[]
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>
  permissions?: Record<string, unknown>
  [key: string]: unknown
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function hasHookCommand(matchers: HookMatcher[], command: string): boolean {
  for (const m of matchers) {
    for (const h of m.hooks) {
      if (h.command === command) return true
    }
  }
  return false
}

function mergeHook(
  settings: ClaudeSettings,
  event: string,
  command: string,
): void {
  if (!settings.hooks) settings.hooks = {}
  if (!settings.hooks[event]) settings.hooks[event] = []

  const matchers = settings.hooks[event]
  if (hasHookCommand(matchers, command)) return // Already present

  matchers.push({
    matcher: '',
    hooks: [{ type: 'command', command }],
  })
}

// ── Main ──────────────────────────────────────────────────────────────────

export async function runInitCommand(projectDir: string, args: string[]): Promise<void> {
  const { flags } = parseArgs(args)
  const isUpdate = flags['update'] === 'true'

  const contextDir = resolve(projectDir, '.context')
  const claudeDir = resolve(projectDir, '.claude')
  const binDir = resolve(claudeDir, 'bin')
  const commandsDir = resolve(claudeDir, 'commands')

  // 1. Create directory structure
  await mkdir(resolve(contextDir, 'db'), { recursive: true })
  await mkdir(resolve(contextDir, 'packets', 'active'), { recursive: true })
  await mkdir(resolve(contextDir, 'packets', 'archive'), { recursive: true })
  await mkdir(binDir, { recursive: true })
  await mkdir(commandsDir, { recursive: true })

  console.log('✓ Created .context/db/, .context/packets/active/, .context/packets/archive/')

  // 2. Create binary wrapper
  const entrypoint = resolveBinaryEntrypoint()
  const wrapperPath = resolve(binDir, 'packet')
  const wrapperContent = `#!/bin/bash
exec node "${entrypoint}" "$@"
`
  await writeFile(wrapperPath, wrapperContent, { mode: 0o755 })
  console.log('✓ Installed .claude/bin/packet')

  // 3. Copy slash command .md files
  const srcCommandsDir = resolvePackageSrcDir()
  let copiedCount = 0
  for (const name of SLASH_COMMANDS) {
    const src = resolve(srcCommandsDir, `${name}.md`)
    const dest = resolve(commandsDir, `${name}.md`)

    if (await fileExists(src)) {
      await copyFile(src, dest)
      copiedCount++
    }
  }
  console.log(`✓ Installed ${copiedCount} slash commands in .claude/commands/`)

  // 4. Merge hooks into .claude/settings.json
  const settingsPath = resolve(claudeDir, 'settings.json')
  const settings = await readJsonFile(settingsPath) as ClaudeSettings
  mergeHook(settings, 'UserPromptSubmit', '.claude/bin/packet context 2>/dev/null')
  mergeHook(settings, 'Stop', '.claude/bin/packet snapshot 2>/dev/null')
  await writeJsonFile(settingsPath, settings)
  console.log('✓ Configured hooks in .claude/settings.json')

  // 5. Add packet permissions to .claude/settings.local.json
  const localSettingsPath = resolve(claudeDir, 'settings.local.json')
  const localSettings = await readJsonFile(localSettingsPath) as Record<string, unknown>
  if (!localSettings.permissions) localSettings.permissions = {}
  const perms = localSettings.permissions as Record<string, unknown>
  if (!perms.allow) perms.allow = []
  const allowList = perms.allow as string[]
  const packetPerm = 'Bash(packet:*)'
  if (!allowList.includes(packetPerm)) {
    allowList.push(packetPerm)
  }
  await writeJsonFile(localSettingsPath, localSettings)
  console.log('✓ Added packet permissions to .claude/settings.local.json')

  // 6. Inject managed section into CLAUDE.md
  const claudeMdPath = resolve(projectDir, 'CLAUDE.md')
  let claudeMd = ''
  if (await fileExists(claudeMdPath)) {
    claudeMd = await readFile(claudeMdPath, 'utf-8')
  }

  const startIdx = claudeMd.indexOf(INSTRUCTIONS_START)
  const endIdx = claudeMd.indexOf(INSTRUCTIONS_END)

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing managed section
    claudeMd =
      claudeMd.slice(0, startIdx) +
      CLAUDE_MD_SECTION +
      claudeMd.slice(endIdx + INSTRUCTIONS_END.length)
  } else {
    // Append managed section
    claudeMd = claudeMd.trimEnd() + '\n\n' + CLAUDE_MD_SECTION + '\n'
  }

  await writeFile(claudeMdPath, claudeMd, 'utf-8')
  console.log('✓ Updated CLAUDE.md with packet instructions')

  console.log('')
  if (isUpdate) {
    console.log('Updated! Commands and hooks have been re-synced.')
  } else {
    console.log('Ready! Open Claude Code and use /packet-new <name> to start.')
  }
}
