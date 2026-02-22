import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  listSkills,
  getSkillByName,
  readSkillContent,
  invalidateSkillCache,
  parseFrontmatter,
} from '../../../src/skills/skill-loader'
import type { SkillLoaderConfig } from '../../../src/skills/types'

// ─── Helper to create temp skill files ──────────────────────────────────────

let tmpDir: string

async function createSkillFile(
  relativePath: string,
  frontmatter: Record<string, string>,
  body: string,
): Promise<string> {
  const fullPath = path.join(tmpDir, relativePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })

  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  const content = `---\n${fm}\n---\n${body}`
  await fs.writeFile(fullPath, content, 'utf8')
  return fullPath
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-skill-loader-'))
  invalidateSkillCache()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─── parseFrontmatter ───────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('parses name and description from YAML frontmatter', () => {
    const raw = `---\nname: code-review\ndescription: Review code for quality\n---\nBody content here.`
    const result = parseFrontmatter(raw)
    expect(result.data['name']).toBe('code-review')
    expect(result.data['description']).toBe('Review code for quality')
    expect(result.content).toBe('Body content here.')
  })

  it('returns empty data when no frontmatter delimiter', () => {
    const raw = 'Just plain markdown content.'
    const result = parseFrontmatter(raw)
    expect(result.data).toEqual({})
    expect(result.content).toBe(raw)
  })

  it('returns empty data when frontmatter is not closed', () => {
    const raw = '---\nname: broken\nNo closing delimiter'
    const result = parseFrontmatter(raw)
    expect(result.data).toEqual({})
    expect(result.content).toBe(raw)
  })

  it('strips surrounding quotes from values', () => {
    const raw = `---\nname: "quoted-name"\ndescription: 'single-quoted'\n---\nBody`
    const result = parseFrontmatter(raw)
    expect(result.data['name']).toBe('quoted-name')
    expect(result.data['description']).toBe('single-quoted')
  })

  it('handles leading whitespace before frontmatter', () => {
    const raw = `  \n---\nname: test\ndescription: A test\n---\nContent`
    const result = parseFrontmatter(raw)
    expect(result.data['name']).toBe('test')
  })
})

// ─── listSkills ─────────────────────────────────────────────────────────────

describe('listSkills', () => {
  it('discovers SKILL.md files matching the glob pattern', async () => {
    await createSkillFile('skills/review/SKILL.md', {
      name: 'code-review',
      description: 'Review code for quality',
    }, 'Review instructions here.')

    await createSkillFile('skills/deploy/SKILL.md', {
      name: 'deploy',
      description: 'Deploy to production',
    }, 'Deploy instructions here.')

    const config: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 0,
    }

    const skills = await listSkills(config)
    expect(skills).toHaveLength(2)

    const names = skills.map((s) => s.name).sort()
    expect(names).toEqual(['code-review', 'deploy'])
  })

  it('skips files without name or description in frontmatter', async () => {
    await createSkillFile('skills/noname/SKILL.md', {
      description: 'No name',
    }, 'Body')

    await createSkillFile('skills/nodesc/SKILL.md', {
      name: 'has-name',
    }, 'Body')

    await createSkillFile('skills/valid/SKILL.md', {
      name: 'valid-skill',
      description: 'This is valid',
    }, 'Body')

    const config: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 0,
    }

    const skills = await listSkills(config)
    expect(skills).toHaveLength(1)
    expect(skills[0]!.name).toBe('valid-skill')
  })

  it('first occurrence wins for duplicate skill names', async () => {
    const highPriDir = path.join(tmpDir, 'high')
    const lowPriDir = path.join(tmpDir, 'low')

    await fs.mkdir(path.join(highPriDir, 'skills', 'dup'), { recursive: true })
    await fs.mkdir(path.join(lowPriDir, 'skills', 'dup'), { recursive: true })

    await fs.writeFile(
      path.join(highPriDir, 'skills', 'dup', 'SKILL.md'),
      '---\nname: shared\ndescription: From high priority\n---\nHigh content',
    )
    await fs.writeFile(
      path.join(lowPriDir, 'skills', 'dup', 'SKILL.md'),
      '---\nname: shared\ndescription: From low priority\n---\nLow content',
    )

    const config: SkillLoaderConfig = {
      roots: [
        { root: highPriDir, pattern: 'skills/**/SKILL.md' },
        { root: lowPriDir, pattern: 'skills/**/SKILL.md' },
      ],
      cacheTtlMs: 0,
    }

    const skills = await listSkills(config)
    expect(skills).toHaveLength(1)
    expect(skills[0]!.description).toBe('From high priority')
  })

  it('handles non-existent root directories gracefully', async () => {
    const config: SkillLoaderConfig = {
      roots: [{ root: '/tmp/nonexistent-dir-xyz-123', pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 0,
    }

    const skills = await listSkills(config)
    expect(skills).toEqual([])
  })

  it('caches results when cacheTtlMs > 0', async () => {
    await createSkillFile('skills/cached/SKILL.md', {
      name: 'cached-skill',
      description: 'A cached skill',
    }, 'Body')

    const config: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 60_000, // 1 minute
    }

    const first = await listSkills(config)
    expect(first).toHaveLength(1)

    // Add another skill file
    await createSkillFile('skills/new/SKILL.md', {
      name: 'new-skill',
      description: 'Should not appear (cached)',
    }, 'Body')

    const second = await listSkills(config)
    expect(second).toHaveLength(1) // Still cached

    // Invalidate and re-list
    invalidateSkillCache()
    const third = await listSkills(config)
    expect(third).toHaveLength(2)
  })

  it('respects dot option for dotfile directories', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'hidden'), { recursive: true })
    await fs.writeFile(
      path.join(tmpDir, '.claude', 'skills', 'hidden', 'SKILL.md'),
      '---\nname: hidden-skill\ndescription: In dotdir\n---\nContent',
    )

    // Without dot: true, should not find
    const noDot: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: '.claude/skills/**/SKILL.md', dot: false }],
      cacheTtlMs: 0,
    }
    const noDotResult = await listSkills(noDot)
    expect(noDotResult).toHaveLength(0)

    // With dot: true, should find
    const withDot: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: '.claude/skills/**/SKILL.md', dot: true }],
      cacheTtlMs: 0,
    }
    const withDotResult = await listSkills(withDot)
    expect(withDotResult).toHaveLength(1)
    expect(withDotResult[0]!.name).toBe('hidden-skill')
  })
})

// ─── getSkillByName ─────────────────────────────────────────────────────────

describe('getSkillByName', () => {
  it('returns the matching skill', async () => {
    await createSkillFile('skills/target/SKILL.md', {
      name: 'target-skill',
      description: 'The target',
    }, 'Target content')

    const config: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 0,
    }

    const skill = await getSkillByName('target-skill', config)
    expect(skill).not.toBeNull()
    expect(skill!.name).toBe('target-skill')
  })

  it('returns null for non-existent skill', async () => {
    const config: SkillLoaderConfig = {
      roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
      cacheTtlMs: 0,
    }

    const skill = await getSkillByName('does-not-exist', config)
    expect(skill).toBeNull()
  })
})

// ─── readSkillContent ───────────────────────────────────────────────────────

describe('readSkillContent', () => {
  it('returns body content after frontmatter', async () => {
    const filePath = await createSkillFile('skills/readable/SKILL.md', {
      name: 'readable',
      description: 'A readable skill',
    }, 'This is the body content.\nWith multiple lines.')

    const content = await readSkillContent(filePath)
    expect(content).toBe('This is the body content.\nWith multiple lines.')
  })

  it('throws on non-existent file', async () => {
    await expect(readSkillContent('/tmp/nonexistent-file.md')).rejects.toThrow()
  })
})
