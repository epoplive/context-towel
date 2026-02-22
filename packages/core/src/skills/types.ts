/**
 * Skill system types for context-towel.
 *
 * Extracted from Felix skill-loader/skill-permissions, stripped of
 * NestJS/MikroORM/Felix-specific dependencies. Pure TypeScript types.
 */

// ─── Skill Definition ───────────────────────────────────────────────────────

/** Metadata about a discovered skill. */
export type SkillDefinition = {
  /** Unique skill name (from frontmatter). */
  name: string
  /** Human-readable description (from frontmatter). */
  description: string
  /** Absolute path to the SKILL.md file. */
  location: string
}

// ─── Skill Configuration ────────────────────────────────────────────────────

/** A single directory root to scan for skill files. */
export type SkillRoot = {
  /** Absolute directory path to scan. */
  root: string
  /** Glob pattern relative to root (e.g. "skills/** /SKILL.md"). */
  pattern: string
  /** Whether to match dotfiles/dotdirs (default false). */
  dot?: boolean
}

/** Configuration for the skill loader. */
export type SkillLoaderConfig = {
  /** Directories to scan for skill files. */
  roots: SkillRoot[]
  /** Cache TTL in ms. Set to 0 to disable caching. Default 30000. */
  cacheTtlMs?: number
}

// ─── Permissions ────────────────────────────────────────────────────────────

/** Permission level for a skill. */
export type PermissionValue = 'ask' | 'allow' | 'deny'

/**
 * Permission config can be:
 * - A single PermissionValue applied to all skills
 * - A map of glob patterns to PermissionValue (most specific wins)
 * - undefined (no filtering)
 */
export type PermissionConfig = PermissionValue | Record<string, PermissionValue> | undefined
