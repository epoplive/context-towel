export interface RuleData {
  id?: string
  name: string
  description?: string
  guidanceText?: string
  ruleType?: string  // coding_pattern, architectural, naming, testing, security, performance, documentation
  priority?: number  // 0-10
  autoApply?: boolean
  confidenceThreshold?: number  // 0-1
  triggerPatterns?: {
    files?: string[]
    components?: string[]
    relationships?: string[]
  }
  semanticTriggers?: {
    patterns?: string[]
    businessDomains?: string[]
    architecturalLayers?: string[]
  }
  codeTemplate?: string
  usageCount?: number
  effectivenessScore?: number  // 0-1
  lastApplied?: string
  tags?: string[]
}

export const ruleTypeColors: Record<string, string> = {
  coding_pattern: '#3b82f6',
  architectural: '#8b5cf6',
  naming: '#14b8a6',
  testing: '#84cc16',
  security: '#ef4444',
  performance: '#f59e0b',
  documentation: '#6b7280',
}
