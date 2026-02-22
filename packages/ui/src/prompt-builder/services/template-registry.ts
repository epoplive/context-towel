/**
 * Template registry service.
 *
 * Manages template storage and retrieval. Works with bundled presets
 * and user-created templates. No external API calls.
 */

import type { VersionedTemplate, TemplateVariable } from '../types'
import { PRESET_TEMPLATES } from '../templates/presets'
import { fillTemplate } from './variable-manager'

// ---------------------------------------------------------------------------
// Template data helpers
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES = ['coding', 'planning', 'general', 'custom'] as const

export function normalizeCategory(category?: string): string {
  return TEMPLATE_CATEGORIES.includes(category as (typeof TEMPLATE_CATEGORIES)[number])
    ? category!
    : 'custom'
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

/**
 * Returns all bundled preset templates.
 */
export function getPresetTemplates(): VersionedTemplate[] {
  return [...PRESET_TEMPLATES]
}

/**
 * Merges preset templates with user templates.
 * User templates override presets with the same ID.
 */
export function mergeTemplates(
  presets: VersionedTemplate[],
  userTemplates: VersionedTemplate[],
): VersionedTemplate[] {
  const map = new Map<string, VersionedTemplate>()

  for (const t of presets) {
    map.set(t.id, t)
  }
  for (const t of userTemplates) {
    map.set(t.id, t)
  }

  return Array.from(map.values())
}

/**
 * Creates a new user template.
 */
export function createTemplate(
  name: string,
  prompt: string,
  category: string,
  variables?: Record<string, TemplateVariable>,
  description?: string,
): VersionedTemplate {
  return {
    id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    name,
    description: description || '',
    category: normalizeCategory(category),
    prompt,
    version: '1.0.0',
    variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'user',
  }
}

/**
 * Creates a duplicate of an existing template.
 */
export function duplicateTemplate(template: VersionedTemplate): VersionedTemplate {
  return {
    ...template,
    id: `custom-${Date.now()}`,
    name: `${template.name} (Copy)`,
    category: 'custom',
    version: template.version || '1.0.0',
    author: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Creates an empty template draft.
 */
export function createEmptyDraft(): VersionedTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: 'New Template',
    description: 'Add description here',
    category: 'custom',
    version: '1.0.0',
    prompt: '',
    author: 'user',
  }
}

/**
 * Fills a versioned template's prompt with variable values.
 */
export function fillVersionedTemplate(
  template: VersionedTemplate,
  values: Record<string, unknown>,
): string {
  return fillTemplate(template.prompt, values)
}
