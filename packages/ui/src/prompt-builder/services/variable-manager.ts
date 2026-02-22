/**
 * Variable management service.
 *
 * Pure functions for managing template variables and their values.
 * No external dependencies - operates on passed-in state.
 */

import type { VariableDefinition, VariableValue } from '../types'

// ---------------------------------------------------------------------------
// Variable CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a new variable definition.
 */
export function createVariable(
  name: string,
  label: string,
  type: VariableDefinition['type'],
  scope: 'system' | 'conversation',
  options?: {
    description?: string
    options?: string[]
    default?: string | number | boolean
    required?: boolean
    category?: string
  },
): VariableDefinition {
  return {
    id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    name,
    label,
    description: options?.description,
    type,
    options: options?.options,
    default: options?.default,
    required: options?.required || false,
    scope,
    category: options?.category || 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Updates a variable definition in a list. Returns a new list.
 */
export function updateVariable(
  definitions: VariableDefinition[],
  variableId: string,
  updates: Partial<VariableDefinition>,
): VariableDefinition[] {
  return definitions.map((v) => {
    if (v.id !== variableId) return v
    return {
      ...v,
      ...updates,
      id: v.id, // Never overwrite id
      updatedAt: new Date().toISOString(),
    }
  })
}

/**
 * Deletes a variable definition. Returns new definitions and values lists.
 */
export function deleteVariable(
  definitions: VariableDefinition[],
  values: VariableValue[],
  variableId: string,
): { definitions: VariableDefinition[]; values: VariableValue[] } {
  return {
    definitions: definitions.filter((v) => v.id !== variableId),
    values: values.filter((v) => v.variableId !== variableId),
  }
}

// ---------------------------------------------------------------------------
// Variable values
// ---------------------------------------------------------------------------

/**
 * Gets variable values for a specific scope, returned as a Record.
 */
export function getVariableValues(
  allValues: VariableValue[],
  scope: 'system' | 'conversation',
  conversationId?: string,
): Record<string, unknown> {
  const filtered = allValues.filter((v) => {
    if (v.scope !== scope) return false
    if (scope === 'conversation' && v.conversationId !== conversationId) return false
    return true
  })

  const result: Record<string, unknown> = {}
  for (const v of filtered) {
    result[v.variableId] = v.value
  }
  return result
}

/**
 * Sets variable values for a scope. Returns a new values array.
 */
export function setVariableValues(
  allValues: VariableValue[],
  newValues: Record<string, unknown>,
  scope: 'system' | 'conversation',
  conversationId?: string,
): VariableValue[] {
  // Remove existing values for this scope/conversation
  const remaining = allValues.filter((v) => {
    if (v.scope !== scope) return true
    if (scope === 'conversation' && v.conversationId !== conversationId) return true
    return false
  })

  // Add new values
  const additions: VariableValue[] = Object.entries(newValues).map(([variableId, value]) => ({
    variableId,
    value,
    scope,
    conversationId: scope === 'conversation' ? conversationId : undefined,
    updatedAt: new Date().toISOString(),
  }))

  return [...remaining, ...additions]
}

/**
 * Gets combined variable values (system + conversation).
 * Conversation values override system values.
 */
export function getCombinedValues(
  allValues: VariableValue[],
  conversationId?: string,
): Record<string, unknown> {
  const systemValues = getVariableValues(allValues, 'system')
  const conversationValues = conversationId
    ? getVariableValues(allValues, 'conversation', conversationId)
    : {}
  return { ...systemValues, ...conversationValues }
}

/**
 * Gets variable definitions filtered by scope.
 */
export function getVariablesByScope(
  definitions: VariableDefinition[],
  scope: 'system' | 'conversation',
): VariableDefinition[] {
  return definitions.filter((v) => v.scope === scope)
}

// ---------------------------------------------------------------------------
// Template filling
// ---------------------------------------------------------------------------

/**
 * Fills a template string with variable values.
 * Supports Handlebars-style {{variable}} and {{#if variable}} conditionals.
 */
export function fillTemplate(template: string, values: Record<string, unknown>): string {
  let result = template

  // Handle Handlebars-style variables: {{variable}}
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName: string) => {
    const trimmed = varName.trim()

    // Handle conditional blocks: {{#if variable}}
    if (trimmed.startsWith('#if ')) {
      const condition = trimmed.substring(4).trim()
      const value = values[condition]
      return value ? '' : '{{REMOVE_SECTION}}'
    }

    // Handle closing conditionals: {{/if}}
    if (trimmed === '/if') {
      return '{{END_SECTION}}'
    }

    // Handle regular variables
    return values[trimmed] !== undefined ? String(values[trimmed]) : match
  })

  // Clean up conditional sections
  result = result.replace(/\{\{REMOVE_SECTION\}\}[\s\S]*?\{\{END_SECTION\}\}/g, '')
  result = result.replace(/\{\{END_SECTION\}\}/g, '')

  return result.trim()
}
