import { describe, it, expect } from 'vitest'
import {
  buildSkillCatalog,
  buildSkillToolDescription,
  buildSkillsSection,
  extractSkillMentions,
} from '../../../src/skills/skill-toc'
import type { SkillDefinition } from '../../../src/skills/types'

const skills: SkillDefinition[] = [
  { name: 'code-review', description: 'Review code for quality', location: '/skills/code-review/SKILL.md' },
  { name: 'deploy', description: 'Deploy to production', location: '/skills/deploy/SKILL.md' },
]

describe('buildSkillCatalog', () => {
  it('returns XML catalog of skills', () => {
    const catalog = buildSkillCatalog(skills)
    expect(catalog).toContain('<available_skills>')
    expect(catalog).toContain('<name>code-review</name>')
    expect(catalog).toContain('<description>Review code for quality</description>')
    expect(catalog).toContain('<name>deploy</name>')
    expect(catalog).toContain('</available_skills>')
  })

  it('returns empty string when no skills', () => {
    expect(buildSkillCatalog([])).toBe('')
  })

  it('filters by permissions', () => {
    const catalog = buildSkillCatalog(skills, { 'deploy': 'deny' })
    expect(catalog).toContain('code-review')
    expect(catalog).not.toContain('<name>deploy</name>')
  })
})

describe('buildSkillToolDescription', () => {
  it('includes catalog and usage info', () => {
    const desc = buildSkillToolDescription(skills)
    expect(desc).toContain('Load a skill to get detailed instructions')
    expect(desc).toContain('code-review')
    expect(desc).toContain('deploy')
  })

  it('returns fallback when no skills available', () => {
    const desc = buildSkillToolDescription([])
    expect(desc).toContain('No skills are currently available')
  })

  it('returns fallback when all skills denied', () => {
    const desc = buildSkillToolDescription(skills, 'deny')
    expect(desc).toContain('No skills are currently available')
  })
})

describe('buildSkillsSection', () => {
  it('includes section header and skill list', () => {
    const section = buildSkillsSection(skills)
    expect(section).toContain('## Skills')
    expect(section).toContain('### Available Skills')
    expect(section).toContain('- code-review: Review code for quality')
    expect(section).toContain('- deploy: Deploy to production')
    expect(section).toContain('### How to Use Skills')
  })

  it('returns empty string when no skills', () => {
    expect(buildSkillsSection([])).toBe('')
  })

  it('filters denied skills from section', () => {
    const section = buildSkillsSection(skills, { 'deploy': 'deny' })
    expect(section).toContain('code-review')
    expect(section).not.toContain('- deploy:')
  })
})

describe('extractSkillMentions', () => {
  it('extracts $skill-name mentions', () => {
    const text = 'Please use $code-review and $deploy skills.'
    const mentions = extractSkillMentions(text)
    expect(mentions).toEqual(['code-review', 'deploy'])
  })

  it('returns empty array for empty input', () => {
    expect(extractSkillMentions('')).toEqual([])
  })

  it('deduplicates mentions (case-insensitive)', () => {
    const text = '$Code-Review and $code-review and $CODE-REVIEW'
    const mentions = extractSkillMentions(text)
    expect(mentions).toHaveLength(1)
  })

  it('handles text with no mentions', () => {
    expect(extractSkillMentions('No mentions here.')).toEqual([])
  })

  it('extracts mentions with underscores and digits', () => {
    const text = 'Use $test_runner_2 for testing.'
    const mentions = extractSkillMentions(text)
    expect(mentions).toEqual(['test_runner_2'])
  })
})
