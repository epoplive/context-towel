/**
 * Skill tool definition for use with PromptManagementPort.
 *
 * When the skill tool is invoked, it reads the skill file content and
 * loads it as a prompt block via PromptManagementPort.loadBlock().
 * When cleared, it calls PromptManagementPort.clearBlock().
 *
 * This replaces Felix's skill-tool.ts which managed state directly
 * through Felix-specific InternalToolContext.
 */

import * as path from 'path'
import type { PromptManagementPort, BlockOptions } from '../prompt/types'
import type { SkillLoaderConfig, PermissionConfig } from './types'
import { listSkills, getSkillByName, readSkillContent } from './skill-loader'
import { buildSkillToolDescription } from './skill-toc'

/**
 * Tool definition shape, structurally compatible with @dm/felix-runtime ToolDefinition.
 */
export type ToolDefinition = {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

/** Result returned from the skill tool execute method. */
export type SkillToolResult = {
  title: string
  output: string
  metadata: {
    name: string
    dir: string
  }
}

/** Options for creating a skill tool definition. */
export type SkillToolOptions = {
  /** Skill loader config with roots to scan. */
  loaderConfig: SkillLoaderConfig
  /** PromptManagementPort to load/clear skill content blocks. */
  promptPort: PromptManagementPort
  /** Optional permission config for filtering accessible skills. */
  permissions?: PermissionConfig
  /** Priority for loaded skill blocks. Default: 'normal'. */
  blockPriority?: BlockOptions['priority']
}

/**
 * Create a ToolDefinition for the skill tool.
 *
 * The returned tool, when executed with `{ name: string }`, will:
 * 1. Look up the skill by name from configured roots
 * 2. Read the skill file content (body after frontmatter)
 * 3. Load the content as a prompt block via PromptManagementPort
 * 4. Return metadata about the loaded skill
 *
 * Throws if the skill is not found (clear error message listing available skills).
 */
export function createSkillTool(options: SkillToolOptions): ToolDefinition {
  const { loaderConfig, promptPort, blockPriority } = options

  return {
    name: 'Skill',
    description: 'Load a skill for detailed instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The skill name from available skills list',
        },
      },
      required: ['name'],
    },

    execute: async (input: Record<string, unknown>): Promise<SkillToolResult> => {
      const name = input['name']
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Skill tool requires a "name" parameter (string).')
      }

      const skill = await getSkillByName(name.trim(), loaderConfig)
      if (!skill) {
        const available = await listSkills(loaderConfig)
        const names = available.map((s) => s.name).join(', ')
        throw new Error(
          `Skill "${name}" not found. Available skills: ${names || 'none'}`,
        )
      }

      const content = await readSkillContent(skill.location)
      const dir = path.dirname(skill.location)

      const blockContent = [
        `## Skill: ${skill.name}`,
        '',
        `**Base directory**: ${dir}`,
        '',
        content,
      ].join('\n')

      const blockId = `skill:${skill.name}`
      promptPort.loadBlock(blockId, blockContent, {
        priority: blockPriority ?? 'normal',
      })

      return {
        title: `Loaded skill: ${skill.name}`,
        output: blockContent,
        metadata: {
          name: skill.name,
          dir,
        },
      }
    },
  }
}

/**
 * Clear a previously loaded skill from the prompt context.
 */
export function clearSkillBlock(
  promptPort: PromptManagementPort,
  skillName: string,
): void {
  promptPort.clearBlock(`skill:${skillName}`)
}

/**
 * Create a skill tool with its description populated from discovered skills.
 * This is a convenience that first lists skills, builds the description
 * from the catalog, then creates the tool definition.
 */
export async function createSkillToolWithCatalog(
  options: SkillToolOptions,
): Promise<ToolDefinition> {
  const skills = await listSkills(options.loaderConfig)
  const tool = createSkillTool(options)
  tool.description = buildSkillToolDescription(skills, options.permissions)
  return tool
}
