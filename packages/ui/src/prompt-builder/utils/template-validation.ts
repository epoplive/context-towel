/**
 * Template validation utilities.
 *
 * Extracted from Felix prompt-manager with all external dependencies removed.
 */

import type { VersionedTemplate } from '../types'

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface SystemPromptTemplate {
  id: string
  name: string
  description: string
  prompt: string
  category: 'coding' | 'planning' | 'general' | 'custom'
}

// ---------------------------------------------------------------------------
// Security constants
// ---------------------------------------------------------------------------

const MAX_PROMPT_LENGTH = 10000
const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /data:(?!image\/)/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /@import/gi,
  /url\s*\(/gi,
]

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes template content by removing dangerous patterns.
 */
export function sanitizeTemplate(content: string): string {
  let sanitized = content

  for (const pattern of DANGEROUS_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0
    sanitized = sanitized.replace(pattern, '')
  }

  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Normalize whitespace
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  return sanitized.trim()
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a system prompt template.
 */
export function validateTemplate(
  template: Partial<SystemPromptTemplate> | Partial<VersionedTemplate>,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required field validation
  if (!template.name || typeof template.name !== 'string') {
    errors.push('Template name is required')
  } else if (template.name.length === 0) {
    errors.push('Template name cannot be empty')
  } else if (template.name.length > MAX_NAME_LENGTH) {
    errors.push(`Template name must be ${MAX_NAME_LENGTH} characters or less`)
  }

  if (!template.prompt || typeof template.prompt !== 'string') {
    errors.push('Template prompt is required')
  } else if (template.prompt.length === 0) {
    errors.push('Template prompt cannot be empty')
  } else if (template.prompt.length > MAX_PROMPT_LENGTH) {
    errors.push(`Template prompt must be ${MAX_PROMPT_LENGTH} characters or less`)
  }

  if (!template.description || typeof template.description !== 'string') {
    errors.push('Template description is required')
  } else if (template.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Template description must be ${MAX_DESCRIPTION_LENGTH} characters or less`)
  }

  if (
    !template.category ||
    !['coding', 'planning', 'general', 'custom'].includes(template.category)
  ) {
    errors.push('Template category must be one of: coding, planning, general, custom')
  }

  // Security validation
  if (template.name) {
    const sanitizedName = sanitizeTemplate(template.name)
    if (template.name !== sanitizedName) {
      errors.push('Template name contains potentially dangerous content')
    }
  }

  if (template.prompt) {
    const sanitizedPrompt = sanitizeTemplate(template.prompt)
    if (template.prompt !== sanitizedPrompt) {
      errors.push('Template prompt contains potentially dangerous content')
    }

    if (template.prompt.includes('eval(') || template.prompt.includes('Function(')) {
      errors.push('Template prompt contains potentially dangerous JavaScript patterns')
    }

    if (template.prompt.length > 5000) {
      warnings.push('Very long prompts may impact performance')
    }
  }

  if (template.description) {
    const sanitizedDescription = sanitizeTemplate(template.description)
    if (template.description !== sanitizedDescription) {
      errors.push('Template description contains potentially dangerous content')
    }
  }

  // ID validation (if provided)
  if (template.id && !/^[a-zA-Z0-9_-]+$/.test(template.id)) {
    errors.push('Template ID can only contain letters, numbers, underscores, and hyphens')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validates a batch of templates.
 */
export function validateTemplates(
  templates: (Partial<SystemPromptTemplate> | Partial<VersionedTemplate>)[],
): ValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  const names = new Set<string>()
  const ids = new Set<string>()

  templates.forEach((template, index) => {
    const result = validateTemplate(template)

    result.errors.forEach((error) => {
      allErrors.push(`Template ${index + 1}: ${error}`)
    })

    result.warnings.forEach((warning) => {
      allWarnings.push(`Template ${index + 1}: ${warning}`)
    })

    if (template.name) {
      const lowerName = template.name.toLowerCase()
      if (names.has(lowerName)) {
        allErrors.push(`Template ${index + 1}: Duplicate template name "${template.name}"`)
      } else {
        names.add(lowerName)
      }
    }

    if (template.id) {
      if (ids.has(template.id)) {
        allErrors.push(`Template ${index + 1}: Duplicate template ID "${template.id}"`)
      } else {
        ids.add(template.id)
      }
    }
  })

  return { isValid: allErrors.length === 0, errors: allErrors, warnings: allWarnings }
}

/**
 * Generates a safe ID from a template name.
 */
export function generateTemplateId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) || `template-${Date.now()}`
  )
}

/**
 * Checks if a template is safe to use.
 */
export function isTemplateSafe(template: SystemPromptTemplate | VersionedTemplate): boolean {
  const validation = validateTemplate(template)
  return validation.isValid
}

/**
 * Creates a safe template by sanitizing all fields.
 */
export function createSafeTemplate(
  template: Partial<SystemPromptTemplate> | Partial<VersionedTemplate>,
): SystemPromptTemplate | VersionedTemplate {
  const isVersioned = 'version' in template

  const baseTemplate = {
    id: template.id || generateTemplateId(template.name || 'untitled'),
    name: sanitizeTemplate(template.name || 'Untitled Template'),
    description: sanitizeTemplate(template.description || 'No description provided'),
    prompt: sanitizeTemplate(template.prompt || ''),
    category: template.category || 'custom',
  }

  const safeTemplate = isVersioned
    ? ({
        ...baseTemplate,
        version: (template as Partial<VersionedTemplate>).version || '1.0.0',
        variables: (template as Partial<VersionedTemplate>).variables,
        createdAt: (template as Partial<VersionedTemplate>).createdAt,
        updatedAt: (template as Partial<VersionedTemplate>).updatedAt,
        author: (template as Partial<VersionedTemplate>).author,
      } as VersionedTemplate)
    : (baseTemplate as SystemPromptTemplate)

  const validation = validateTemplate(safeTemplate)
  if (!validation.isValid) {
    throw new Error(`Cannot create safe template: ${validation.errors.join(', ')}`)
  }

  return safeTemplate
}
