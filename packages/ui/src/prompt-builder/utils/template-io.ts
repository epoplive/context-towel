/**
 * Template import/export utilities.
 *
 * Extracted from Felix prompt-manager. All Felix-specific dependencies removed.
 */

import type { VersionedTemplate } from '../types'
import {
  validateTemplates,
  type SystemPromptTemplate,
  type ValidationResult,
} from './template-validation'

// ---------------------------------------------------------------------------
// Template exchange format
// ---------------------------------------------------------------------------

const TEMPLATE_FORMAT_VERSION = '1.0.0'

export interface TemplateExportData {
  version: string
  exportDate: string
  templates: (SystemPromptTemplate | VersionedTemplate)[]
  metadata: {
    source: string
    templateCount: number
    categories: string[]
  }
}

export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  errors: string[]
  warnings: string[]
  importedTemplates: (SystemPromptTemplate | VersionedTemplate)[]
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Exports templates to JSON string.
 */
export function exportTemplates(
  templates: (SystemPromptTemplate | VersionedTemplate)[],
  selectedIds?: string[],
): string {
  const templatesToExport = selectedIds
    ? templates.filter((t) => selectedIds.includes(t.id))
    : templates

  const exportData: TemplateExportData = {
    version: TEMPLATE_FORMAT_VERSION,
    exportDate: new Date().toISOString(),
    templates: templatesToExport,
    metadata: {
      source: 'context-towel',
      templateCount: templatesToExport.length,
      categories: [...new Set(templatesToExport.map((t) => t.category))],
    },
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Triggers a download of templates as a JSON file.
 * Only works in browser environments.
 */
export function downloadTemplates(
  templates: (SystemPromptTemplate | VersionedTemplate)[],
  selectedIds?: string[],
  filename?: string,
): void {
  const exportJson = exportTemplates(templates, selectedIds)
  const blob = new Blob([exportJson], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const defaultFilename = `prompt-templates-${new Date().toISOString().split('T')[0]}.json`
  const link = document.createElement('a')
  link.href = url
  link.download = filename || defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Import validation
// ---------------------------------------------------------------------------

function validateImportFormat(data: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('Invalid file format: not a valid JSON object')
    return { isValid: false, errors, warnings }
  }

  const record = data as Record<string, unknown>

  if (!record['version']) {
    warnings.push('No version information found - assuming compatible format')
  } else if (record['version'] !== TEMPLATE_FORMAT_VERSION) {
    warnings.push(
      `Version mismatch: file is ${String(record['version'])}, expected ${TEMPLATE_FORMAT_VERSION}`,
    )
  }

  if (!Array.isArray(record['templates'])) {
    errors.push('Invalid format: templates must be an array')
    return { isValid: false, errors, warnings }
  }

  const templates = record['templates'] as unknown[]
  templates.forEach((template, index) => {
    if (!template || typeof template !== 'object') {
      errors.push(`Template ${index + 1}: Invalid template object`)
      return
    }

    const t = template as Record<string, unknown>
    const requiredFields = ['id', 'name', 'description', 'prompt', 'category']
    for (const field of requiredFields) {
      if (!t[field] || typeof t[field] !== 'string') {
        errors.push(`Template ${index + 1}: Missing or invalid field '${field}'`)
      }
    }

    if (
      t['category'] &&
      !['coding', 'planning', 'general', 'custom'].includes(t['category'] as string)
    ) {
      warnings.push(
        `Template ${index + 1}: Unknown category '${String(t['category'])}', will be set to 'custom'`,
      )
    }
  })

  return { isValid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Imports templates from JSON data.
 */
export function importTemplates(
  jsonData: string,
  existingTemplates: (SystemPromptTemplate | VersionedTemplate)[],
  options: {
    replaceExisting?: boolean
    skipDuplicates?: boolean
    validateContent?: boolean
  } = {},
): ImportResult {
  const { replaceExisting = false, skipDuplicates = true, validateContent = true } = options

  try {
    const data = JSON.parse(jsonData)

    const formatValidation = validateImportFormat(data)
    if (!formatValidation.isValid) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: formatValidation.errors,
        warnings: formatValidation.warnings,
        importedTemplates: [],
      }
    }

    const errors: string[] = []
    const warnings: string[] = [...formatValidation.warnings]
    const importedTemplates: (SystemPromptTemplate | VersionedTemplate)[] = []
    const existingIds = new Set(existingTemplates.map((t) => t.id))
    const existingNames = new Set(existingTemplates.map((t) => t.name.toLowerCase()))
    let skippedCount = 0

    for (let i = 0; i < data.templates.length; i++) {
      const template = data.templates[i]
      const templateIndex = i + 1

      try {
        const isVersioned = 'version' in template

        const baseTemplate = {
          id: template.id as string,
          name: (template.name as string).trim(),
          description: (template.description as string).trim(),
          prompt: (template.prompt as string).trim(),
          category: ['coding', 'planning', 'general', 'custom'].includes(
            template.category as string,
          )
            ? (template.category as string)
            : 'custom',
        }

        const normalizedTemplate: SystemPromptTemplate | VersionedTemplate = isVersioned
          ? ({
              ...baseTemplate,
              version: (template.version as string) || '1.0.0',
              variables: template.variables as Record<string, unknown> | undefined,
              createdAt: template.createdAt as string | undefined,
              updatedAt: template.updatedAt as string | undefined,
              author: template.author as string | undefined,
            } as VersionedTemplate)
          : (baseTemplate as SystemPromptTemplate)

        const isDuplicateId = existingIds.has(normalizedTemplate.id)
        const isDuplicateName = existingNames.has(normalizedTemplate.name.toLowerCase())

        if (isDuplicateId || isDuplicateName) {
          if (skipDuplicates && !replaceExisting) {
            warnings.push(
              `Template ${templateIndex}: Skipped duplicate '${normalizedTemplate.name}'`,
            )
            skippedCount++
            continue
          } else if (!replaceExisting) {
            normalizedTemplate.id = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
            if (isDuplicateName) {
              normalizedTemplate.name = `${normalizedTemplate.name} (Imported)`
            }
          }
        }

        if (validateContent) {
          const validation = validateTemplates([normalizedTemplate])
          if (!validation.isValid) {
            errors.push(`Template ${templateIndex}: ${validation.errors.join(', ')}`)
            continue
          }

          if (validation.warnings.length > 0) {
            warnings.push(`Template ${templateIndex}: ${validation.warnings.join(', ')}`)
          }
        }

        importedTemplates.push(normalizedTemplate)
      } catch (error) {
        errors.push(
          `Template ${templateIndex}: Failed to process - ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    return {
      success: importedTemplates.length > 0,
      importedCount: importedTemplates.length,
      skippedCount,
      errors,
      warnings,
      importedTemplates,
    }
  } catch (error) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: [error instanceof Error ? error.message : 'Failed to parse JSON file'],
      warnings: [],
      importedTemplates: [],
    }
  }
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

/**
 * Reads a file and returns its content as string.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('File reading failed'))
    reader.readAsText(file)
  })
}

/**
 * Validates a file before import.
 */
export function validateImportFile(file: File): { isValid: boolean; error?: string } {
  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
    return { isValid: false, error: 'File must be a JSON file (.json)' }
  }

  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return { isValid: false, error: 'File is too large (max 10MB)' }
  }

  if (file.size === 0) {
    return { isValid: false, error: 'File is empty' }
  }

  return { isValid: true }
}

/**
 * Simplified template file export (triggers browser download).
 */
export function exportTemplatesFile(templates: (SystemPromptTemplate | VersionedTemplate)[]): void {
  downloadTemplates(templates)
}

/**
 * Parses a template import file content and returns the result.
 */
export function parseTemplateImport<T extends SystemPromptTemplate | VersionedTemplate>(
  content: string,
  existingTemplates: T[],
): { success: boolean; templates: T[]; imported: number; error?: string } {
  const result = importTemplates(content, existingTemplates)
  if (result.success) {
    return {
      success: true,
      templates: result.importedTemplates as T[],
      imported: result.importedCount,
    }
  }
  return {
    success: false,
    templates: [],
    imported: 0,
    error: result.errors.join('; '),
  }
}
