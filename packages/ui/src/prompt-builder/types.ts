/**
 * Prompt builder types.
 *
 * Self-contained type definitions for the prompt builder UI.
 * No external Felix dependencies.
 */

// ---------------------------------------------------------------------------
// Template variable types
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean'
  label: string
  description?: string
  placeholder?: string
  options?: string[]
  default?: string | number | boolean
  required?: boolean
  min?: number
  max?: number
}

export interface VersionedTemplate {
  id: string
  name: string
  description: string
  category: string
  prompt: string
  version: string
  variables?: Record<string, TemplateVariable>
  author?: string
  createdAt?: string
  updatedAt?: string
}

// ---------------------------------------------------------------------------
// System prompt types
// ---------------------------------------------------------------------------

export interface SystemPrompt {
  id: string
  type: 'main' | 'rules' | 'project' | 'custom'
  source: 'template' | 'auto-generated' | 'user'
  content: string
  templateId?: string
  templateName?: string
  originalTemplate?: VersionedTemplate
  templateValues?: Record<string, unknown>
  metadata?: {
    rulesCount?: number
    filesAnalyzed?: string[]
    variables?: Record<string, unknown>
    individualRules?: CodeIndexerRule[]
  }
}

// ---------------------------------------------------------------------------
// Variable management types
// ---------------------------------------------------------------------------

export interface VariableDefinition {
  id: string
  name: string
  label: string
  description?: string
  type: 'text' | 'select' | 'textarea' | 'number' | 'boolean'
  options?: string[]
  default?: string | number | boolean
  required?: boolean
  scope: 'system' | 'conversation'
  category?: string
  createdAt: string
  updatedAt: string
}

export interface VariableValue {
  variableId: string
  value: unknown
  scope: 'system' | 'conversation'
  conversationId?: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Code indexer rule types (for optional rules integration)
// ---------------------------------------------------------------------------

export interface CodeIndexerRule {
  id: string
  name: string
  content?: string
  guidance_text?: string
  rule_type?: string
  trigger_patterns?: {
    files?: string[]
    [key: string]: unknown
  }
  priority?: number
  parent_id?: string | null
  sort_order?: number
  auto_apply?: boolean
  usage_count?: number
  acceptance_rate?: number
  effectiveness_score?: number
  last_used?: string
  metadata?: unknown
  finalScore?: number
}

export interface ProjectInfo {
  name?: string
  path?: string
  description?: string
  architecture?: string
  techStack?: string[]
  conventions?: string
  language?: string
  framework?: string
  type?: string
}

// ---------------------------------------------------------------------------
// Prompt chain types
// ---------------------------------------------------------------------------

export interface PromptChainTemplate {
  id: string
  name: string
  description: string
  prompts: SystemPrompt[]
}

// ---------------------------------------------------------------------------
// Rules provider interface (optional integration)
// ---------------------------------------------------------------------------

/**
 * Optional interface for integrating a code rules service.
 * Consumers that have a code indexer can implement this to provide
 * contextual rules in the prompt builder.
 */
export interface RulesProvider {
  searchRules(query: string): Promise<CodeIndexerRule[]>
  generateRulesPrompt(
    messageContent: string,
    context?: {
      systemPrompts?: SystemPrompt[]
      projectInfo?: ProjectInfo
      attachedFiles?: string[]
    },
  ): Promise<SystemPrompt | null>
  getProjectInfo(): Promise<ProjectInfo | null>
  generateProjectPrompt(): Promise<SystemPrompt | null>
}

// ---------------------------------------------------------------------------
// Template categories
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES = ['coding', 'planning', 'general', 'custom'] as const
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]
