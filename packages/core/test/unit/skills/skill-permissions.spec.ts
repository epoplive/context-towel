import { describe, it, expect } from 'vitest'
import {
  resolveSkillPermission,
  filterSkillsByPermission,
  wildcardMatch,
} from '../../../src/skills/skill-permissions'
import type { PermissionConfig } from '../../../src/skills/types'

describe('wildcardMatch', () => {
  it('matches exact strings', () => {
    expect(wildcardMatch('code-review', 'code-review')).toBe(true)
  })

  it('does not match different strings', () => {
    expect(wildcardMatch('code-review', 'deploy')).toBe(false)
  })

  it('matches * as any sequence', () => {
    expect(wildcardMatch('code-review', 'code-*')).toBe(true)
    expect(wildcardMatch('code-review', '*-review')).toBe(true)
    expect(wildcardMatch('code-review', '*')).toBe(true)
    expect(wildcardMatch('code-review', 'code-*-extra')).toBe(false)
  })

  it('matches ? as single character', () => {
    expect(wildcardMatch('abc', 'a?c')).toBe(true)
    expect(wildcardMatch('ac', 'a?c')).toBe(false)
  })

  it('escapes regex special characters in pattern', () => {
    expect(wildcardMatch('a.b', 'a.b')).toBe(true)
    expect(wildcardMatch('axb', 'a.b')).toBe(false) // . is literal, not regex any
  })
})

describe('resolveSkillPermission', () => {
  it('returns undefined for undefined config', () => {
    expect(resolveSkillPermission('anything', undefined)).toBeUndefined()
  })

  it('returns the global value for string config', () => {
    expect(resolveSkillPermission('anything', 'allow')).toBe('allow')
    expect(resolveSkillPermission('anything', 'deny')).toBe('deny')
    expect(resolveSkillPermission('anything', 'ask')).toBe('ask')
  })

  it('returns undefined for invalid string config', () => {
    expect(resolveSkillPermission('anything', 'invalid' as any)).toBeUndefined()
  })

  it('matches exact pattern in record config', () => {
    const config: PermissionConfig = {
      'code-review': 'deny',
      'deploy': 'allow',
    }
    expect(resolveSkillPermission('code-review', config)).toBe('deny')
    expect(resolveSkillPermission('deploy', config)).toBe('allow')
  })

  it('returns undefined for unmatched name in record config', () => {
    const config: PermissionConfig = {
      'code-review': 'deny',
    }
    expect(resolveSkillPermission('deploy', config)).toBeUndefined()
  })

  it('longer (more specific) patterns override shorter ones', () => {
    const config: PermissionConfig = {
      '*': 'allow',
      'code-*': 'deny',
    }
    // 'code-*' is longer and more specific
    expect(resolveSkillPermission('code-review', config)).toBe('deny')
    // 'deploy' only matches '*'
    expect(resolveSkillPermission('deploy', config)).toBe('allow')
  })
})

describe('filterSkillsByPermission', () => {
  const skills = [
    { name: 'code-review', description: 'Review code' },
    { name: 'deploy', description: 'Deploy' },
    { name: 'test-runner', description: 'Run tests' },
  ]

  it('returns all skills when permissions are undefined', () => {
    const result = filterSkillsByPermission(skills, undefined)
    expect(result).toHaveLength(3)
  })

  it('excludes denied skills', () => {
    const config: PermissionConfig = {
      'deploy': 'deny',
    }
    const result = filterSkillsByPermission(skills, config)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.name)).not.toContain('deploy')
  })

  it('excludes all skills when global deny', () => {
    const result = filterSkillsByPermission(skills, 'deny')
    expect(result).toHaveLength(0)
  })

  it('includes all skills when global allow', () => {
    const result = filterSkillsByPermission(skills, 'allow')
    expect(result).toHaveLength(3)
  })
})
