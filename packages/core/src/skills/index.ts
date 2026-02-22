// Skills system - file discovery, TOC building, permissions, and tool definition

// Types
export type {
  SkillDefinition,
  SkillRoot,
  SkillLoaderConfig,
  PermissionValue,
  PermissionConfig,
} from './types'

// Skill loader
export {
  listSkills,
  getSkillByName,
  readSkillContent,
  invalidateSkillCache,
  parseFrontmatter,
} from './skill-loader'

// Permissions
export {
  resolveSkillPermission,
  filterSkillsByPermission,
  wildcardMatch,
} from './skill-permissions'

// TOC builder
export {
  buildSkillCatalog,
  buildSkillToolDescription,
  buildSkillsSection,
  extractSkillMentions,
} from './skill-toc'

// Skill tool
export type { SkillToolResult, SkillToolOptions } from './skill-tool'
export {
  createSkillTool,
  clearSkillBlock,
  createSkillToolWithCatalog,
} from './skill-tool'
