/**
 * Skill table-of-contents (TOC) builder.
 *
 * Builds formatted sections for system prompts, listing available skills
 * and usage instructions. Extracted from Felix skill-instructions.ts.
 */

import type { SkillDefinition, PermissionConfig } from './types'
import { filterSkillsByPermission } from './skill-permissions'

/**
 * Format a single skill line for the TOC.
 */
function formatSkillLine(skill: SkillDefinition): string {
  return `- ${skill.name}: ${skill.description}`
}

/**
 * Build an XML-style skill catalog suitable for embedding in a tool
 * description string. Each skill is listed with its name and description.
 *
 * Returns empty string if no skills are accessible.
 */
export function buildSkillCatalog(
  skills: SkillDefinition[],
  permissions?: PermissionConfig,
): string {
  const accessible = filterSkillsByPermission(skills, permissions)
  if (accessible.length === 0) return ''

  return [
    '<available_skills>',
    ...accessible.flatMap((skill) => [
      '  <skill>',
      `    <name>${skill.name}</name>`,
      `    <description>${skill.description}</description>`,
      '  </skill>',
    ]),
    '</available_skills>',
  ].join('\n')
}

/**
 * Build the tool description for the skill tool, including the catalog of
 * available skills. Suitable for setting as the `description` field of a
 * tool definition.
 */
export function buildSkillToolDescription(
  skills: SkillDefinition[],
  permissions?: PermissionConfig,
): string {
  const accessible = filterSkillsByPermission(skills, permissions)
  if (accessible.length === 0) {
    return 'Load a skill to get detailed instructions for a specific task. No skills are currently available.'
  }

  return [
    'Load a skill to get detailed instructions for a specific task.',
    'Skills provide specialized knowledge and step-by-step guidance.',
    "Use this when a task matches an available skill's description.",
    'Required parameter: name (skill identifier from available_skills).',
    buildSkillCatalog(skills, permissions),
  ].join(' ')
}

/**
 * Build a full "Skills" section suitable for inclusion in a system prompt.
 * Includes the skill list and usage instructions.
 *
 * Returns empty string if no skills are accessible.
 */
export function buildSkillsSection(
  skills: SkillDefinition[],
  permissions?: PermissionConfig,
): string {
  const accessible = filterSkillsByPermission(skills, permissions)
  if (accessible.length === 0) return ''

  const lines: string[] = [
    '## Skills',
    '',
    'Skills provide specialized instructions and workflows for specific tasks. When a task matches a skill\'s description, use the skill tool to load its full instructions.',
    '',
    '### Available Skills',
    '',
    ...accessible.map(formatSkillLine),
    '',
    '### How to Use Skills',
    '',
    '1. **Automatic activation**: When your request matches a skill\'s description, use that skill.',
    '',
    '2. **Loading a skill**: Use the skill tool with the skill name as the parameter.',
    '',
    '3. **Progressive disclosure**: After loading the skill, follow its instructions. Load supporting files only as needed.',
    '',
    '4. **Multiple skills**: If multiple skills apply, use all relevant ones.',
    '',
    '5. **Not found**: If a skill isn\'t listed, it\'s not available. Continue without it.',
  ]

  return lines.join('\n')
}

/**
 * Extract $skill-name mentions from text.
 * Returns unique skill names in order of first occurrence.
 */
export function extractSkillMentions(text: string): string[] {
  if (!text) return []
  const SKILL_MENTION_RE = /\$([A-Za-z0-9][\w-]*)/g
  const seen = new Set<string>()
  const results: string[] = []
  let match: RegExpExecArray | null
  while ((match = SKILL_MENTION_RE.exec(text)) !== null) {
    const name = (match[1] ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(name)
  }
  return results
}
