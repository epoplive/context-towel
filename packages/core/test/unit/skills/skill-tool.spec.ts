import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import type { PromptManagementPort, PromptBlock, BlockOptions } from '../../../src/prompt/types'
import { createSkillTool, clearSkillBlock, createSkillToolWithCatalog } from '../../../src/skills/skill-tool'
import { invalidateSkillCache } from '../../../src/skills/skill-loader'
import type { SkillLoaderConfig } from '../../../src/skills/types'

// ─── Mock PromptManagementPort ──────────────────────────────────────────────

function createMockPromptPort(): PromptManagementPort {
  const blocks = new Map<string, PromptBlock>()

  return {
    loadBlock(id: string, content: string, options?: BlockOptions): void {
      blocks.set(id, {
        id,
        content,
        priority: options?.priority ?? 'normal',
        addedAt: new Date().toISOString(),
        options,
      })
    },
    clearBlock(id: string): void {
      blocks.delete(id)
    },
    refreshBlock(id: string, content: string): void {
      const existing = blocks.get(id)
      if (existing) {
        blocks.set(id, { ...existing, content })
      }
    },
    getBlocks(): PromptBlock[] {
      return Array.from(blocks.values())
    },
    assembleSystemPrompt(): string {
      return Array.from(blocks.values())
        .map((b) => b.content)
        .join('\n\n')
    },
  }
}

// ─── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string
let promptPort: PromptManagementPort
let loaderConfig: SkillLoaderConfig

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
  await fs.writeFile(fullPath, `---\n${fm}\n---\n${body}`, 'utf8')
  return fullPath
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-skill-tool-'))
  promptPort = createMockPromptPort()
  loaderConfig = {
    roots: [{ root: tmpDir, pattern: 'skills/**/SKILL.md' }],
    cacheTtlMs: 0,
  }
  invalidateSkillCache()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createSkillTool', () => {
  it('loads skill content into prompt port when executed', async () => {
    await createSkillFile('skills/review/SKILL.md', {
      name: 'code-review',
      description: 'Review code for quality',
    }, 'Follow these review steps...')

    const tool = createSkillTool({ loaderConfig, promptPort })
    const result = await tool.execute({ name: 'code-review' }) as any

    expect(result.title).toBe('Loaded skill: code-review')
    expect(result.output).toContain('## Skill: code-review')
    expect(result.output).toContain('Follow these review steps...')
    expect(result.metadata.name).toBe('code-review')

    // Verify prompt port received the block
    const blocks = promptPort.getBlocks()
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.id).toBe('skill:code-review')
    expect(blocks[0]!.content).toContain('Follow these review steps...')
  })

  it('throws with clear message when skill not found', async () => {
    await createSkillFile('skills/only/SKILL.md', {
      name: 'existing-skill',
      description: 'Exists',
    }, 'Body')

    const tool = createSkillTool({ loaderConfig, promptPort })

    await expect(tool.execute({ name: 'nonexistent' })).rejects.toThrow(
      /Skill "nonexistent" not found.*existing-skill/,
    )
  })

  it('throws when name parameter is missing', async () => {
    const tool = createSkillTool({ loaderConfig, promptPort })

    await expect(tool.execute({})).rejects.toThrow(
      'Skill tool requires a "name" parameter (string).',
    )
  })

  it('throws when name parameter is empty string', async () => {
    const tool = createSkillTool({ loaderConfig, promptPort })

    await expect(tool.execute({ name: '' })).rejects.toThrow(
      'Skill tool requires a "name" parameter (string).',
    )
  })

  it('uses configured block priority', async () => {
    await createSkillFile('skills/prio/SKILL.md', {
      name: 'prio-skill',
      description: 'Priority test',
    }, 'Content')

    const tool = createSkillTool({ loaderConfig, promptPort, blockPriority: 'high' })
    await tool.execute({ name: 'prio-skill' })

    const blocks = promptPort.getBlocks()
    expect(blocks[0]!.priority).toBe('high')
  })

  it('has correct tool definition shape', () => {
    const tool = createSkillTool({ loaderConfig, promptPort })
    expect(tool.name).toBe('Skill')
    expect(tool.inputSchema.type).toBe('object')
    expect(tool.inputSchema.required).toEqual(['name'])
    expect(typeof tool.execute).toBe('function')
  })
})

describe('clearSkillBlock', () => {
  it('removes the skill block from prompt port', async () => {
    await createSkillFile('skills/clearme/SKILL.md', {
      name: 'clearable',
      description: 'Will be cleared',
    }, 'Content')

    const tool = createSkillTool({ loaderConfig, promptPort })
    await tool.execute({ name: 'clearable' })
    expect(promptPort.getBlocks()).toHaveLength(1)

    clearSkillBlock(promptPort, 'clearable')
    expect(promptPort.getBlocks()).toHaveLength(0)
  })
})

describe('createSkillToolWithCatalog', () => {
  it('populates description from discovered skills', async () => {
    await createSkillFile('skills/cat/SKILL.md', {
      name: 'catalog-skill',
      description: 'A cataloged skill',
    }, 'Content')

    const tool = await createSkillToolWithCatalog({ loaderConfig, promptPort })
    expect(tool.description).toContain('catalog-skill')
    expect(tool.description).toContain('A cataloged skill')
  })
})
