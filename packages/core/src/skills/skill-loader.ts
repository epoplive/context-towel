/**
 * Skill file discovery and loading.
 *
 * Discovers SKILL.md files from configurable directory roots, parses
 * frontmatter for name/description, and returns SkillDefinition objects.
 *
 * No external dependencies beyond Node fs/path and gray-matter.
 * Extracted from Felix skill-loader.ts with all Felix-specific code removed.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { SkillDefinition, SkillLoaderConfig, SkillRoot } from './types'

// ─── Frontmatter parsing ────────────────────────────────────────────────────

/**
 * Minimal frontmatter parser.
 *
 * Supports YAML-style frontmatter delimited by `---`.
 * Only extracts `name` and `description` string fields.
 * This avoids a dependency on gray-matter for the core package.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, string>
  content: string
} {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { data: {}, content: raw }
  }

  const frontmatterBlock = trimmed.slice(3, endIndex).trim()
  const content = trimmed.slice(endIndex + 3).trim()

  const data: Record<string, string> = {}
  for (const line of frontmatterBlock.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) data[key] = value
  }

  return { data, content }
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL_MS = 30_000

type CacheEntry = {
  timestamp: number
  skills: SkillDefinition[]
}

const skillCache = new Map<string, CacheEntry>()

function getCacheKey(roots: SkillRoot[]): string {
  return JSON.stringify(roots)
}

/** Invalidate all cached skill lists, or only those for given roots. */
export function invalidateSkillCache(roots?: SkillRoot[]): void {
  if (!roots) {
    skillCache.clear()
    return
  }
  const key = getCacheKey(roots)
  skillCache.delete(key)
}

// ─── File scanning ──────────────────────────────────────────────────────────

/**
 * Recursively walk a directory tree and return files matching a simple glob
 * pattern. Supports `**` for recursive descent and `*` for single-segment
 * wildcard. This avoids a runtime dependency on the `glob` npm package.
 */
async function walkGlob(
  root: string,
  pattern: string,
  options?: { dot?: boolean },
): Promise<string[]> {
  const dot = options?.dot ?? false
  const results: string[] = []

  // Split the pattern into segments
  const segments = pattern.split('/')

  async function walk(dir: string, segIdx: number): Promise<void> {
    if (segIdx >= segments.length) return

    const segment = segments[segIdx]!
    const isLast = segIdx === segments.length - 1

    if (segment === '**') {
      // ** matches zero or more directories
      // Try matching the rest of the pattern from here
      await walk(dir, segIdx + 1)

      // Also recurse into subdirectories and try ** again
      let entries: { name: string; isDirectory: boolean }[]
      try {
        const dirents = await fs.readdir(dir, { withFileTypes: true })
        entries = dirents.map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
      } catch {
        return
      }

      for (const entry of entries) {
        if (!dot && entry.name.startsWith('.')) continue
        if (entry.isDirectory) {
          await walk(path.join(dir, entry.name), segIdx) // ** can match more dirs
        }
      }
      return
    }

    // Non-** segment: read directory and match
    let entries: { name: string; isDirectory: boolean }[]
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true })
      entries = dirents.map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
    } catch {
      return
    }

    const regex = new RegExp(
      '^' +
        segment
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '[^/]*') +
        '$',
    )

    for (const entry of entries) {
      if (!dot && entry.name.startsWith('.')) continue
      if (!regex.test(entry.name)) continue

      const full = path.join(dir, entry.name)
      if (isLast) {
        if (!entry.isDirectory) {
          results.push(full)
        }
      } else if (entry.isDirectory) {
        await walk(full, segIdx + 1)
      }
    }
  }

  await walk(root, 0)
  return results
}

// ─── Skill parsing ──────────────────────────────────────────────────────────

async function parseSkillFile(filePath: string): Promise<SkillDefinition | null> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }

  const { data } = parseFrontmatter(raw)
  const name = (data['name'] ?? '').trim()
  const description = (data['description'] ?? '').trim()

  if (!name || !description) return null

  return {
    name,
    description,
    location: path.resolve(filePath),
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Discover and return all skills from the configured roots.
 *
 * First skill with a given name wins (higher-priority roots should come first
 * in the config). Results are cached for `cacheTtlMs` milliseconds.
 */
export async function listSkills(config: SkillLoaderConfig): Promise<SkillDefinition[]> {
  const cacheTtl = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const cacheKey = getCacheKey(config.roots)

  if (cacheTtl > 0) {
    const cached = skillCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      return cached.skills
    }
  }

  const seen = new Set<string>()
  const allPaths: string[] = []

  for (const root of config.roots) {
    const resolvedRoot = path.resolve(root.root)
    try {
      const matches = await walkGlob(resolvedRoot, root.pattern, { dot: root.dot })
      for (const match of matches) {
        const resolved = path.resolve(match)
        if (seen.has(resolved)) continue
        seen.add(resolved)
        allPaths.push(resolved)
      }
    } catch {
      // Ignore invalid roots or scan failures
    }
  }

  const byName = new Map<string, SkillDefinition>()
  for (const filePath of allPaths) {
    const skill = await parseSkillFile(filePath)
    if (!skill) continue
    // First occurrence wins (higher-priority roots listed first)
    if (!byName.has(skill.name)) {
      byName.set(skill.name, skill)
    }
  }

  const skills = Array.from(byName.values())

  if (cacheTtl > 0) {
    skillCache.set(cacheKey, { timestamp: Date.now(), skills })
  }

  return skills
}

/**
 * Find a single skill by name from the configured roots.
 * Returns null if not found.
 */
export async function getSkillByName(
  name: string,
  config: SkillLoaderConfig,
): Promise<SkillDefinition | null> {
  const skills = await listSkills(config)
  return skills.find((s) => s.name === name) ?? null
}

/**
 * Read the body content of a skill file (everything after frontmatter).
 * Throws if the file cannot be read.
 */
export async function readSkillContent(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath, 'utf8')
  const { content } = parseFrontmatter(raw)
  return content
}
