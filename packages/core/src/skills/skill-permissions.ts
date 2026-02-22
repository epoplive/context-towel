/**
 * Skill permission checking.
 *
 * Supports three modes:
 * - Global: a single PermissionValue applies to all skills
 * - Per-skill: a map of glob patterns to PermissionValue (longest match wins)
 * - Undefined: no filtering, all skills accessible
 *
 * Extracted from Felix skill-permissions.ts, no external dependencies.
 */

import type { PermissionConfig, PermissionValue } from './types'

function normalizePermission(value: unknown): PermissionValue | undefined {
  if (value === 'allow' || value === 'deny' || value === 'ask') return value
  return undefined
}

/**
 * Match a string against a glob-like pattern supporting * and ? wildcards.
 * - `*` matches any sequence of characters (including empty)
 * - `?` matches exactly one character
 */
export function wildcardMatch(str: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    's',
  )
  return regex.test(str)
}

/**
 * Resolve the effective permission for a skill name given a permission config.
 *
 * When config is a record of patterns, patterns are sorted by length (shortest
 * first) so that more specific (longer) patterns override less specific ones.
 * Returns undefined if no config or no matching pattern.
 */
export function resolveSkillPermission(
  name: string,
  permissions: PermissionConfig,
): PermissionValue | undefined {
  if (!permissions) return undefined
  if (typeof permissions === 'string') return normalizePermission(permissions)
  if (typeof permissions !== 'object') return undefined

  const entries = Object.entries(permissions).sort(
    ([a], [b]) => a.length - b.length || a.localeCompare(b),
  )
  let result: PermissionValue | undefined
  for (const [pattern, value] of entries) {
    if (!wildcardMatch(name, pattern)) continue
    const normalized = normalizePermission(value)
    if (normalized) result = normalized
  }
  return result
}

/**
 * Filter a list of skills by permission config.
 * Skills with 'deny' permission are excluded; all others are kept.
 */
export function filterSkillsByPermission<T extends { name: string }>(
  skills: T[],
  permissions: PermissionConfig,
): T[] {
  return skills.filter((skill) => resolveSkillPermission(skill.name, permissions) !== 'deny')
}
