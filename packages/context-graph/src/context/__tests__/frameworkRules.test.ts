import { describe, it, expect } from 'vitest'
import {
  FRAMEWORK_RULES,
  INDEX_FORMAT_RULES,
  CANARY_VERIFICATION_RULES,
  PATTERN_REFERENCE_RULES,
  DOC_LIFECYCLE_RULES,
  CONFLICT_RESOLUTION_RULES,
} from '../frameworkRules'

describe('PATTERN_REFERENCE_RULES', () => {
  it('defines pattern category prefixes', () => {
    expect(PATTERN_REFERENCE_RULES).toContain('CP-NN')
    expect(PATTERN_REFERENCE_RULES).toContain('IP-NN')
    expect(PATTERN_REFERENCE_RULES).toContain('CM-NN')
    expect(PATTERN_REFERENCE_RULES).toContain('TP-NN')
    expect(PATTERN_REFERENCE_RULES).toContain('IRB-NN')
  })

  it('defines document reference types', () => {
    expect(PATTERN_REFERENCE_RULES).toContain('IA-NNN')
    expect(PATTERN_REFERENCE_RULES).toContain('CV-NNN')
    expect(PATTERN_REFERENCE_RULES).toContain('OR-NNN')
    expect(PATTERN_REFERENCE_RULES).toContain('UF-NNN')
  })

  it('includes pattern-to-architecture mapping guidance', () => {
    expect(PATTERN_REFERENCE_RULES).toContain('Pattern-to-Architecture Mapping')
    expect(PATTERN_REFERENCE_RULES).toContain('entity IDs')
  })

  it('includes creation guidance', () => {
    expect(PATTERN_REFERENCE_RULES).toContain('When to Create Pattern References')
  })
})

describe('DOC_LIFECYCLE_RULES', () => {
  it('maps folder structure to lifecycle stages', () => {
    expect(DOC_LIFECYCLE_RULES).toContain('.context/docs/')
    expect(DOC_LIFECYCLE_RULES).toContain('.context/working/')
    expect(DOC_LIFECYCLE_RULES).toContain('.context/archive/')
  })

  it('defines document update process', () => {
    expect(DOC_LIFECYCLE_RULES).toContain('Document Update Process')
    expect(DOC_LIFECYCLE_RULES).toContain('Identify need')
    expect(DOC_LIFECYCLE_RULES).toContain('Promote to stable')
  })

  it('defines status indicators', () => {
    expect(DOC_LIFECYCLE_RULES).toContain('[in-progress]')
    expect(DOC_LIFECYCLE_RULES).toContain('[complete]')
    expect(DOC_LIFECYCLE_RULES).toContain('[planned]')
    expect(DOC_LIFECYCLE_RULES).toContain('[needs-testing]')
    expect(DOC_LIFECYCLE_RULES).toContain('[has-issues]')
    expect(DOC_LIFECYCLE_RULES).toContain('[needs-docs]')
  })

  it('defines progressive summarization levels', () => {
    expect(DOC_LIFECYCLE_RULES).toContain('Progressive Summarization')
    expect(DOC_LIFECYCLE_RULES).toContain('Raw details')
    expect(DOC_LIFECYCLE_RULES).toContain('Architecture overview')
    expect(DOC_LIFECYCLE_RULES).toContain('Index entry')
  })

  it('includes cross-reference maintenance guidance', () => {
    expect(DOC_LIFECYCLE_RULES).toContain('Cross-Reference Maintenance')
    expect(DOC_LIFECYCLE_RULES).toContain('entity IDs')
    expect(DOC_LIFECYCLE_RULES).toContain('pattern references')
  })
})

describe('CONFLICT_RESOLUTION_RULES', () => {
  it('defines conflict types', () => {
    expect(CONFLICT_RESOLUTION_RULES).toContain('Structure')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Range')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Logic')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Pattern')
  })

  it('defines resolution strategies', () => {
    expect(CONFLICT_RESOLUTION_RULES).toContain('implementation_wins')
    expect(CONFLICT_RESOLUTION_RULES).toContain('docs_wins')
    expect(CONFLICT_RESOLUTION_RULES).toContain('manual_merge')
  })

  it('categorizes resolution by automation level', () => {
    expect(CONFLICT_RESOLUTION_RULES).toContain('Automatic Resolution')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Semi-Automatic Resolution')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Manual Resolution Required')
  })

  it('references staleness detection integration', () => {
    expect(CONFLICT_RESOLUTION_RULES).toContain('checkStaleness')
  })

  it('defines the resolution process', () => {
    expect(CONFLICT_RESOLUTION_RULES).toContain('Run staleness detection')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Categorize each stale reference')
    expect(CONFLICT_RESOLUTION_RULES).toContain('Apply resolution strategy')
  })
})

describe('all rule constants are well-formed', () => {
  const rules = [
    { name: 'FRAMEWORK_RULES', value: FRAMEWORK_RULES },
    { name: 'INDEX_FORMAT_RULES', value: INDEX_FORMAT_RULES },
    { name: 'CANARY_VERIFICATION_RULES', value: CANARY_VERIFICATION_RULES },
    { name: 'PATTERN_REFERENCE_RULES', value: PATTERN_REFERENCE_RULES },
    { name: 'DOC_LIFECYCLE_RULES', value: DOC_LIFECYCLE_RULES },
    { name: 'CONFLICT_RESOLUTION_RULES', value: CONFLICT_RESOLUTION_RULES },
  ]

  for (const { name, value } of rules) {
    it(`${name} is a non-empty trimmed string`, () => {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
      expect(value).toBe(value.trim())
    })

    it(`${name} starts with a markdown heading`, () => {
      expect(value).toMatch(/^##\s/)
    })
  }
})
